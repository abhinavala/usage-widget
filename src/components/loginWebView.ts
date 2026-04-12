import {
  WebViewConfig,
  WebViewMessage,
  WebViewMessageType,
  WebViewResponse,
  SessionData,
  CookieData,
} from '../types/webview';

const CLAUDE_LOGIN_URL = 'https://claude.ai/login';
const DEFAULT_TIMEOUT = 30_000;

export class LoginError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'LoginError';
    this.code = code;
  }
}

export type MessageHandler = (message: WebViewMessage) => void;
export type DismissHandler = () => void;

export interface LoginWebViewOptions {
  config?: Partial<WebViewConfig>;
  onMessage?: MessageHandler;
  onDismiss?: DismissHandler;
}

export class LoginWebView {
  private config: WebViewConfig;
  private webContents: Electron.WebContents | null = null;
  private window: Electron.BrowserWindow | null = null;
  private onMessage: MessageHandler | null;
  private onDismiss: DismissHandler | null;
  private isDestroyed = false;
  private loadingState: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(options: LoginWebViewOptions = {}) {
    this.config = {
      url: options.config?.url ?? CLAUDE_LOGIN_URL,
      userAgent: options.config?.userAgent,
      timeout: options.config?.timeout ?? DEFAULT_TIMEOUT,
    };
    this.onMessage = options.onMessage ?? null;
    this.onDismiss = options.onDismiss ?? null;
  }

  getLoadingState(): string {
    return this.loadingState;
  }

  isActive(): boolean {
    return !this.isDestroyed && this.window !== null;
  }

  async loadLoginPage(config?: WebViewConfig): Promise<void> {
    const activeConfig = config ?? this.config;

    const { BrowserWindow } = await import('electron');

    this.window = new BrowserWindow({
      width: 480,
      height: 640,
      show: true,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.webContents = this.window.webContents;

    if (activeConfig.userAgent) {
      this.webContents.setUserAgent(activeConfig.userAgent);
    }

    this.window.on('closed', () => {
      this.handleWindowClosed();
    });

    this.setupMessageHandler();

    this.loadingState = 'loading';

    const loadPromise = new Promise<void>((resolve, reject) => {
      this.timeoutId = setTimeout(() => {
        reject(new LoginError('Login page load timed out', 'timeout'));
      }, activeConfig.timeout);

      this.webContents!.once('did-finish-load', () => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
        this.loadingState = 'loaded';
        this.emitMessage({
          type: WebViewMessageType.PAGE_LOADED,
          payload: { url: activeConfig.url },
        });
        resolve();
      });

      this.webContents!.once('did-fail-load', (_event: any, errorCode: number, errorDescription: string) => {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
        this.loadingState = 'error';
        reject(new LoginError(`Failed to load login page: ${errorDescription}`, 'load_failed'));
      });
    });

    await this.window.loadURL(activeConfig.url);
    await loadPromise;
  }

  async extractSessionData(): Promise<SessionData> {
    if (!this.webContents || this.isDestroyed) {
      throw new LoginError('WebView is not active', 'no_session');
    }

    const { session } = this.webContents;
    const cookies = await session.cookies.get({ domain: '.claude.ai' });

    if (!cookies || cookies.length === 0) {
      throw new LoginError('No session cookies found — authentication may not have completed', 'no_session');
    }

    const sessionCookies: CookieData[] = cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain ?? '.claude.ai',
      path: cookie.path ?? '/',
      httpOnly: cookie.httpOnly ?? false,
      secure: cookie.secure ?? false,
    }));

    const tokenCookie = cookies.find(
      (c) => c.name === 'sessionKey' || c.name === '__cf_bm' || c.name === 'lastActiveOrg'
    );

    return {
      cookies: sessionCookies,
      token: tokenCookie?.value,
    };
  }

  async handleLoginSuccess(): Promise<WebViewResponse> {
    try {
      const sessionData = await this.extractSessionData();

      this.emitMessage({
        type: WebViewMessageType.LOGIN_SUCCESS,
        payload: sessionData,
      });

      return { success: true, data: sessionData };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error during login';

      this.emitMessage({
        type: WebViewMessageType.LOGIN_ERROR,
        payload: { error },
      });

      return { success: false, error };
    }
  }

  dismiss(): void {
    if (this.isDestroyed) return;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }

    this.cleanup();

    if (this.onDismiss) {
      this.onDismiss();
    }
  }

  private cleanup(): void {
    this.isDestroyed = true;
    this.webContents = null;
    this.window = null;
    this.loadingState = 'idle';
  }

  private handleWindowClosed(): void {
    this.cleanup();
    if (this.onDismiss) {
      this.onDismiss();
    }
  }

  private setupMessageHandler(): void {
    if (!this.webContents) return;

    this.webContents.on('ipc-message', (_event: any, channel: string, ...args: any[]) => {
      if (channel === 'webview-message') {
        const message: WebViewMessage = args[0];
        this.emitMessage(message);
      }
    });

    this.webContents.on('did-navigate', (_event: any, url: string) => {
      if (url.includes('claude.ai') && !url.includes('/login')) {
        this.emitMessage({
          type: WebViewMessageType.LOGIN_ATTEMPT,
          payload: { url },
        });
        this.handleLoginSuccess();
      }
    });
  }

  private emitMessage(message: WebViewMessage): void {
    if (this.onMessage) {
      this.onMessage(message);
    }
  }
}

export async function loadLoginPage(config: WebViewConfig): Promise<void> {
  const webView = new LoginWebView({ config });
  await webView.loadLoginPage();
}
