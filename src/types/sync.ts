import type { SystemStatus } from './system';

export interface UsageData {
  tokensUsed: number;
  requestCount: number;
  lastActiveTime: Date;
  systemStatus?: SystemStatus;
}

export interface SyncData {
  usageData: UsageData;
  lastSyncTime: Date;
  syncVersion: number;
}

export type SyncOperation = 'read' | 'write' | 'delete';

export interface SyncResult {
  success: boolean;
  operation: SyncOperation;
  timestamp: Date;
  error?: string;
}
