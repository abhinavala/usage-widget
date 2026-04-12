import { LoginState, LoginError } from '../types/auth';
import { LoginFlowState } from '../types/config';
import { KeychainManager } from './keychainManager';
import { AuthenticationManager } from './authenticationManager';

export interface LoginTriggerConfig {
  /** How often to validate credentials (ms). Defaults to 5 minutes. */
  validationIntervalMs: number;
  /** Whether to trigger login automatically on startup. Defaults to true. */
  autoTriggerOnStartup: boolean;
}

const DEFAULT_CONFIG: LoginTriggerConfig = {
  validationIntervalMs: 5 * 60 * 1000,
  autoTriggerOnStartup: true,
};

export interface LoginTriggerStatus {
  loginState: LoginState;
  flowState: LoginFlowState;
  isFirstRun: boolean;
  lastValidationTime: number | null;
}

export class LoginTrigger {
  private keychainManager: KeychainManager;
  private authManager: AuthenticationManager;
  private config: LoginTriggerConfig;
  private isFirstRun: boolean = true;
  private lastValidationTime: number | null = null;
  private loginInProgress: boolean = false;

  constructor(
    keychainManager: KeychainManager,
    authManager: AuthenticationManager,
    config?: Partial<LoginTriggerConfig>,
  ) {
    this.keychainManager = keychainManager;
    this.authManager = authManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check current authentication status without side effects.
   * Returns LoginState.IDLE when no credentials are stored,
   * LoginState.SUCCESS when valid credentials exist,
   * LoginState.LOADING when a login flow is in progress,
   * LoginState.ERROR when stored credentials are invalid/expired.
   */
  async checkAuthenticationStatus(): Promise<LoginState> {
    if (this.loginInProgress) {
      return LoginState.LOADING;
    }

    return this.checkInternalStatus();
  }

  /**
   * Detect first-run scenario and trigger login if no valid credentials exist.
   * Returns true if a login flow was started, false if credentials are already valid.
   */
  async triggerLoginIfNeeded(): Promise<boolean> {
    if (this.loginInProgress) {
      return false;
    }

    this.loginInProgress = true;
    try {
      const status = await this.checkInternalStatus();

      if (status === LoginState.SUCCESS) {
        return false;
      }

      await this.authManager.startLoginFlow();
      this.lastValidationTime = Date.now();
      return true;
    } catch (error) {
      if (error instanceof LoginError) {
        throw error;
      }
      throw new LoginError(
        error instanceof Error ? error.message : 'Login trigger failed',
        'trigger_failed',
      );
    } finally {
      this.loginInProgress = false;
    }
  }

  /**
   * Internal status check that bypasses the loginInProgress guard.
   */
  private async checkInternalStatus(): Promise<LoginState> {
    try {
      const session = await this.keychainManager.retrieveSession();

      if (!session) {
        return LoginState.IDLE;
      }

      const isValid = await this.keychainManager.isSessionValid();
      return isValid ? LoginState.SUCCESS : LoginState.ERROR;
    } catch {
      return LoginState.ERROR;
    }
  }

  /**
   * Called on each fetch timer tick. Validates credentials before allowing
   * the fetch to proceed. Triggers re-authentication if needed.
   * Returns true if fetch can proceed, false if authentication is required.
   */
  async onFetchTimerTick(): Promise<boolean> {
    const status = await this.checkAuthenticationStatus();

    if (status === LoginState.LOADING) {
      return false;
    }

    if (status === LoginState.SUCCESS) {
      this.lastValidationTime = Date.now();
      return true;
    }

    // Credentials missing or expired — trigger re-auth
    try {
      await this.triggerLoginIfNeeded();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle app startup: detect first-run and trigger login if configured.
   * Handles edge cases like network unavailability and keychain access issues.
   */
  async onAppStartup(): Promise<void> {
    const session = await this.keychainManager.retrieveSession();
    this.isFirstRun = session === null;

    if (this.config.autoTriggerOnStartup) {
      try {
        await this.triggerLoginIfNeeded();
      } catch {
        // Startup login failure is non-fatal in LaunchAgent context.
        // The periodic fetch timer will retry.
      }
    }
  }

  /**
   * Manually trigger authentication (e.g., from a menu item or status bar action).
   */
  async manualLoginTrigger(): Promise<boolean> {
    return this.triggerLoginIfNeeded();
  }

  /**
   * Get the current trigger status for reporting.
   */
  getStatus(): LoginTriggerStatus {
    return {
      loginState: this.authManager.getLoginState(),
      flowState: this.authManager.getFlowState(),
      isFirstRun: this.isFirstRun,
      lastValidationTime: this.lastValidationTime,
    };
  }
}

export default LoginTrigger;
