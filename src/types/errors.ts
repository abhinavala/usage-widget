export class SyncError extends Error {
  code: string;
  operation: string;

  constructor(message: string, code: string, operation: string) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.operation = operation;
  }
}
