import { ProgressThreshold } from './progress';

export enum SyncError {
  ICLOUD_UNAVAILABLE = 'ICLOUD_UNAVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class ProgressConfigurationError extends Error { code: string; threshold?: ProgressThreshold; } // src/types/errors.ts

export class ColorValidationError extends Error { code: string; color: string; } // src/types/errors.ts
