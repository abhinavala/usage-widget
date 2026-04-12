import { ErrorLogger } from './ErrorLogger';

export type FetcherType = 'webapi' | 'cli';

export type RecoveryActionType =
  | 'switch_fetcher'
  | 'trigger_reauth'
  | 'retry_sync'
  | 'graceful_degradation'
  | 'none';

export interface RecoveryResult {
  action: RecoveryActionType;
  success: boolean;
  message: string;
}

export interface RecoveryCallbacks {
  onSwitchFetcher?: (newFetcher: FetcherType) => void;
  onTriggerReauth?: () => void;
  onRetrySync?: () => void;
}

export class RecoveryActions {
  private logger: ErrorLogger;
  private callbacks: RecoveryCallbacks;
  private currentFetcher: FetcherType = 'webapi';
  private consecutiveWebAPIFailures: number = 0;
  private readonly webAPIFailureThreshold: number = 3;

  constructor(logger: ErrorLogger, callbacks: RecoveryCallbacks = {}) {
    this.logger = logger;
    this.callbacks = callbacks;
  }

  getCurrentFetcher(): FetcherType {
    return this.currentFetcher;
  }

  getConsecutiveWebAPIFailures(): number {
    return this.consecutiveWebAPIFailures;
  }

  async switchFetcher(reason: string): Promise<RecoveryResult> {
    const newFetcher: FetcherType = this.currentFetcher === 'webapi' ? 'cli' : 'webapi';
    this.logger.info('recovery', `Switching fetcher from "${this.currentFetcher}" to "${newFetcher}": ${reason}`);

    this.currentFetcher = newFetcher;
    this.consecutiveWebAPIFailures = 0;

    if (this.callbacks.onSwitchFetcher) {
      this.callbacks.onSwitchFetcher(newFetcher);
    }

    return {
      action: 'switch_fetcher',
      success: true,
      message: `Switched to ${newFetcher} fetcher: ${reason}`,
    };
  }

  async triggerReauth(): Promise<RecoveryResult> {
    this.logger.info('recovery', 'Triggering re-authentication flow');

    if (this.callbacks.onTriggerReauth) {
      this.callbacks.onTriggerReauth();
    }

    return {
      action: 'trigger_reauth',
      success: true,
      message: 'Re-authentication flow initiated',
    };
  }

  async retrySync(): Promise<RecoveryResult> {
    this.logger.info('recovery', 'Retrying sync operation');

    if (this.callbacks.onRetrySync) {
      this.callbacks.onRetrySync();
    }

    return {
      action: 'retry_sync',
      success: true,
      message: 'Sync retry initiated',
    };
  }

  async handlePersistentWebAPIFailure(): Promise<RecoveryResult> {
    this.consecutiveWebAPIFailures++;

    if (this.consecutiveWebAPIFailures >= this.webAPIFailureThreshold) {
      this.logger.warning(
        'recovery',
        `WebAPI has failed ${this.consecutiveWebAPIFailures} consecutive times, switching to CLI fetcher`,
      );
      return this.switchFetcher('persistent WebAPI failures');
    }

    return {
      action: 'none',
      success: true,
      message: `WebAPI failure ${this.consecutiveWebAPIFailures}/${this.webAPIFailureThreshold} before fallback`,
    };
  }

  resetWebAPIFailureCount(): void {
    this.consecutiveWebAPIFailures = 0;
  }

  async gracefulDegradation(component: string, reason: string): Promise<RecoveryResult> {
    this.logger.warning('recovery', `Graceful degradation for "${component}": ${reason}`);

    return {
      action: 'graceful_degradation',
      success: true,
      message: `Component "${component}" degraded: ${reason}`,
    };
  }
}
