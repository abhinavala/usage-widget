import { UsageData, ManualOverride } from './usage';

export interface SyncData {
  usage?: UsageData;
  manualOverride?: ManualOverride;
  lastSync: Date;
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';
