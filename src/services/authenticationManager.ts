import { LoginResult, LoginState, LoginError, SessionExpiredError } from '../types/auth';
import { LoginFlowConfig, LoginFlowState } from '../types/config';
import { LoginSession, StoredSession } from '../types/storage';
import { KeychainManager } from './keychainManager';
import { LoginWebView, LoginWebViewOptions } from '../components/loginWebView';

const DEFAULT_CONFIG: LoginFlowConfig = {
  maxRetries: 3,
  timeoutMs: 30_000,
  baseUrl: 'https://claude.ai/login',
};

const SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export type WebViewFactory = (options: LoginWebViewOptions) => LoginWebView;

export class AuthenticationManager {
  private state: LoginState = LoginState.IDLE;
  private flowState: LoginFlowState = {
    isActive: false,
    currentStep: 'idle',
    progress: 0,
  };
  private keychainManager: KeychainManager;
  private activeWebView: LoginWebView | null = null;
  private onStateChange: ((state: LoginState) => void) | null = null;
  private createWebView: WebViewFactory;

  constructor(
    keychainManager?: KeychainManager,
    onStateChange?: (state: LoginState) => void,
    webViewFactory?: WebViewFactory,
  ) {
    this.keychainManager = keychainManager ?? new KeychainManager();
    this.onStateChange = onStateChange ?? null;
    this.createWebView = webViewFactory ?? ((opts) => new LoginWebView(opts));
  }

  getLoginState(): LoginState {
    return this.state;
  }

  getFlowState(): LoginFlowState {
    return { ...this.flowState };
  }

  private setState(state: LoginState): void {
    this.state = state;
    if (this.onStateChange) {
      this.onStateChange(state);
    }
  }

  private updateFlowState(update: Partial<LoginFlowState>): void {
    this.flowState = { ...this.flowState, ...update };
  }

  async startLoginFlow(config?: Partial<LoginFlowConfig>): Promise<LoginResult> {
    if (this.flowState.isActive) {
      throw new LoginError('A login flow is already active', 'flow_active');
    }

    const mergedConfig: LoginFlowConfig = { ...DEFAULT_CONFIG, ...config };
    this.setState(LoginState.LOADING);
    this.updateFlowState({ isActive: true, currentStep: 'initializing', progress: 0 });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
        await this.delay(backoffMs);
        this.updateFlowState({
          currentStep: `retry_${attempt}`,
          progress: (attempt / (mergedConfig.maxRetries + 1)) * 50,
        });
      }

      try {
        const result = await this.attemptLogin(mergedConfig);
        this.setState(LoginState.SUCCESS);
        this.updateFlowState({ isActive: false, currentStep: 'complete', progress: 100 });
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof LoginError && err.code === 'flow_cancelled') {
          break;
        }
      }
    }

    this.setState(LoginState.ERROR);
    this.updateFlowState({ isActive: false, currentStep: 'failed', progress: 0 });

    const errorMessage = lastError?.message ?? 'Login failed after retries';
    const errorCode = lastError instanceof LoginError ? lastError.code : 'webview_failed';

    throw new LoginError(errorMessage, errorCode);
  }

  private async attemptLogin(config: LoginFlowConfig): Promise<LoginResult> {
    this.updateFlowState({ currentStep: 'loading_webview', progress: 25 });

    const webView = this.createWebView({
      config: {
        url: config.baseUrl,
        timeout: config.timeoutMs,
      },
    });
    this.activeWebView = webView;

    try {
      await webView.loadLoginPage();
    } catch (err) {
      this.activeWebView = null;
      if (err instanceof Error) {
        throw new LoginError(
          `WebView failed to load: ${err.message}`,
          'webview_failed',
        );
      }
      throw new LoginError('WebView failed to load', 'webview_failed');
    }

    this.updateFlowState({ currentStep: 'awaiting_login', progress: 50 });

    const response = await webView.handleLoginSuccess();
    this.activeWebView = null;

    if (!response.success || !response.data) {
      throw new LoginError(
        response.error ?? 'Login did not complete successfully',
        'login_failed',
      );
    }

    this.updateFlowState({ currentStep: 'storing_session', progress: 75 });

    const sessionData = response.data;
    const session: LoginSession = {
      cookies: JSON.stringify(sessionData.cookies),
      sessionId: sessionData.token ?? '',
      expiresAt: Date.now() + SESSION_EXPIRY_MS,
    };

    await this.keychainManager.storeSession(session);

    this.updateFlowState({ currentStep: 'complete', progress: 100 });

    return {
      success: true,
      session,
    };
  }

  async validateSession(): Promise<boolean> {
    const isValid = await this.keychainManager.isSessionValid();

    if (!isValid) {
      await this.refreshSession();
      return false;
    }

    return true;
  }

  async refreshSession(): Promise<LoginResult> {
    await this.keychainManager.cleanupExpiredSession();
    return this.startLoginFlow();
  }

  async getStoredSession(): Promise<StoredSession | null> {
    return this.keychainManager.retrieveSession();
  }

  async logout(): Promise<void> {
    if (this.activeWebView) {
      this.activeWebView.dismiss();
      this.activeWebView = null;
    }

    await this.keychainManager.clearSession();
    this.setState(LoginState.IDLE);
    this.updateFlowState({ isActive: false, currentStep: 'idle', progress: 0 });
  }

  cancelLoginFlow(): void {
    if (this.activeWebView) {
      this.activeWebView.dismiss();
      this.activeWebView = null;
    }

    this.updateFlowState({ isActive: false, currentStep: 'cancelled', progress: 0 });
    this.setState(LoginState.IDLE);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default AuthenticationManager;
