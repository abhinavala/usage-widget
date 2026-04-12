export interface WebViewConfig {
  url: string;
  userAgent?: string;
  timeout: number;
}

export interface WebViewMessage {
  type: string;
  payload: any;
}

export interface WebViewResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export enum WebViewMessageType {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_ERROR = 'login_error',
  PAGE_LOADED = 'page_loaded',
}

export interface SessionData {
  cookies: CookieData[];
  token?: string;
}

export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
}
