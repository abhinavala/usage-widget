export interface AuthCredentials {
  sessionToken?: string;
  cookies?: string;
  lastAuthTime: Date;
}

export type AuthState = 'authenticated' | 'unauthenticated' | 'expired' | 'invalid';
