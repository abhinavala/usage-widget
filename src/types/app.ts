import { UsageData, SyncState } from './sync';
import { ManualOverride } from './override';

export interface AppState {
  usageData: UsageData;
  syncState: SyncState;
  manualOverride?: ManualOverride;
  lastFetchTime: Date;
}
