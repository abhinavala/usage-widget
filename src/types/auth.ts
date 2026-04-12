export interface AuthCredentials {
  sessionToken?: string;
  cookies?: string;
  lastAuthTime: Date;
}

export type AuthState = 'authenticated' | 'unauthenticated' | 'expired' | 'invalid';

export interface AuthResult {
  state: AuthState;
  credentials?: AuthCredentials;
  error?: string;
}
