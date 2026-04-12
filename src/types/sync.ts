import type { ManualOverride } from './usage';

export interface UsageData {
  tokensUsed: number;
  tokensLimit: number;
  messagesUsed: number;
  messagesLimit: number;
  resetTime: Date;
  lastUpdated: Date;
}

export interface SyncState {
  lastSyncTime: Date;
  isStale: boolean;
  syncError?: string;
}

export interface CloudSyncData {
  usageData: UsageData;
  syncTimestamp: Date;
  deviceId: string;
}

export enum SyncStatusEnum {
  SYNCING = 'syncing',
  SUCCESS = 'success',
  ERROR = 'error',
  STALE = 'stale',
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

export interface SyncData {
  usage?: UsageData;
  manualOverride?: ManualOverride;
  lastSync: Date;
}

export class SyncError extends Error {
  code: string;
  operation: string;
  recoverable: boolean;

  constructor(
    message: string,
    code: string,
    operation: string,
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.operation = operation;
    this.recoverable = recoverable;
  }
}
