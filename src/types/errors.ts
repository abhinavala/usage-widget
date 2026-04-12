export class AuthError extends Error {
  code: string;
  requiresReauth: boolean;

  constructor(message: string, code: string, requiresReauth: boolean = false) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.requiresReauth = requiresReauth;
  }
}
