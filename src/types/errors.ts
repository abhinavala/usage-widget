import { ProgressThreshold } from './progress';

export enum SyncError {
  ICLOUD_UNAVAILABLE = 'ICLOUD_UNAVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class ProgressConfigurationError extends Error { // src/types/errors.ts
  code: string;
  threshold?: ProgressThreshold;

  constructor(message: string) {
    super(message);
    this.name = 'ProgressConfigurationError';
    this.code = '';
  }
}

export class ColorValidationError extends Error { // src/types/errors.ts
  code: string;
  color: string;

  constructor(message: string) {
    super(message);
    this.name = 'ColorValidationError';
    this.code = '';
    this.color = '';
  }
}
