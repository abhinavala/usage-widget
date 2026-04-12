import {
  UsageData,
  SyncStatus,
  SyncError,
} from '../types/sync';
import { ManualOverride } from '../types/override';
import { AppState } from '../types/app';
import { CloudSyncManager } from '../services/CloudSyncManager';

export type { ManualOverride } from '../types/override';
export type { AppState } from '../types/app';

const OVERRIDE_STORAGE_KEY = 'com.claudeusage.manualOverride';
const DEFAULT_OVERRIDE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export function isOverrideExpired(override: ManualOverride): boolean {
  return override.expiresAt.getTime() < Date.now();
}

function applyOverrideToUsageData(
  usageData: UsageData,
  override: ManualOverride
): UsageData {
  return {
    ...usageData,
    tokensUsed: override.tokensUsed ?? usageData.tokensUsed,
    tokensLimit: override.tokensLimit ?? usageData.tokensLimit,
    messagesUsed: override.requestsUsed ?? usageData.messagesUsed,
    messagesLimit: override.requestsLimit ?? usageData.messagesLimit,
  };
}

export class ManualOverrideService {
  private syncManager: CloudSyncManager;
  private currentOverride: ManualOverride | null = null;

  constructor(syncManager: CloudSyncManager) {
    this.syncManager = syncManager;
  }

  async saveManualOverride(override: ManualOverride): Promise<SyncStatus> {
    if (isOverrideExpired(override)) {
      throw new SyncError(
        'Cannot save an expired override',
        'OVERRIDE_EXPIRED',
        'saveOverride',
        false
      );
    }

    this.currentOverride = override;

    const cloudData = await this.syncManager.readUsageData();
    const baseUsageData = cloudData?.usageData ?? this.getDefaultUsageData();

    const mergedUsageData = applyOverrideToUsageData(baseUsageData, override);

    const status = await this.syncManager.writeUsageData(mergedUsageData);
    return status;
  }

  async loadAppState(): Promise<AppState> {
    const cloudData = await this.syncManager.readUsageData();
    const syncState = this.syncManager.getSyncState();

    const usageData = cloudData?.usageData ?? this.getDefaultUsageData();
    const lastFetchTime = cloudData?.syncTimestamp ?? new Date(0);

    let activeOverride = this.currentOverride;
    if (activeOverride && isOverrideExpired(activeOverride)) {
      activeOverride = null;
      this.currentOverride = null;
    }

    return {
      usageData: activeOverride
        ? applyOverrideToUsageData(usageData, activeOverride)
        : usageData,
      syncState,
      manualOverride: activeOverride ?? undefined,
      lastFetchTime,
    };
  }

  async resolveConflict(keepOverride: boolean): Promise<AppState> {
    if (keepOverride && this.currentOverride) {
      if (isOverrideExpired(this.currentOverride)) {
        this.currentOverride = null;
      } else {
        await this.saveManualOverride(this.currentOverride);
      }
    } else {
      this.currentOverride = null;
    }

    return this.loadAppState();
  }

  hasConflict(): boolean {
    if (!this.currentOverride || isOverrideExpired(this.currentOverride)) {
      return false;
    }
    const syncState = this.syncManager.getSyncState();
    return !syncState.isStale && this.currentOverride.isActive;
  }

  clearOverride(): void {
    this.currentOverride = null;
  }

  getCurrentOverride(): ManualOverride | null {
    if (this.currentOverride && isOverrideExpired(this.currentOverride)) {
      this.currentOverride = null;
    }
    return this.currentOverride;
  }

  createOverride(
    overrides: Omit<ManualOverride, 'isActive' | 'expiresAt'>,
    durationMs: number = DEFAULT_OVERRIDE_DURATION_MS
  ): ManualOverride {
    return {
      ...overrides,
      isActive: true,
      expiresAt: new Date(Date.now() + durationMs),
    };
  }

  private getDefaultUsageData(): UsageData {
    return {
      tokensUsed: 0,
      tokensLimit: 0,
      messagesUsed: 0,
      messagesLimit: 0,
      resetTime: new Date(),
      lastUpdated: new Date(),
    };
  }
}
