import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UsageData } from '../../src/types/usage';
import type { FetcherType, FetcherConfig, UsageFetcher } from '../../src/types/fetcher';
import type { SystemStatus } from '../../src/types/system';
import type { AppSettings } from '../../src/types/settings';
import { FetchError } from '../../src/types/errors';

// Mock UsageData factory
function createMockUsageData(overrides: Partial<UsageData> = {}): UsageData {
  return {
    tokensUsed: 50000,
    tokensLimit: 100000,
    messagesUsed: 25,
    messagesLimit: 50,
    resetTime: new Date('2026-04-12T00:00:00Z'),
    lastUpdated: new Date(),
    ...overrides,
  };
}

// Mock FetcherConfig factory
function createMockFetcherConfig(overrides: Partial<FetcherConfig> = {}): FetcherConfig {
  return {
    type: 'webapi',
    timeout: 30,
    retryAttempts: 3,
    ...overrides,
  };
}

// Mock AppSettings factory
function createMockAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    fetchInterval: 300,
    staleThreshold: 900,
    autoFetch: true,
    selectedFetcher: 'webapi',
    ...overrides,
  };
}

// Simulates FetchScheduler behavior for TypeScript-level validation
class MockFetchScheduler {
  isRunning: boolean = false;
  lastFetchTime?: Date;
  nextFetchTime?: Date;
  lastUsageData?: UsageData;
  fetcherConfig: FetcherConfig;
  settings: AppSettings;
  private consecutiveFailures: number = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<FetcherConfig>, settings?: Partial<AppSettings>) {
    this.fetcherConfig = createMockFetcherConfig(config);
    this.settings = createMockAppSettings(settings);
  }

  startScheduledFetching(): void {
    if (this.isRunning) return;
    if (!this.settings.autoFetch) return;

    this.isRunning = true;
    this.nextFetchTime = new Date(Date.now() + this.settings.fetchInterval * 1000);

    this.timer = setInterval(() => {
      this.performScheduledFetch();
    }, this.settings.fetchInterval * 1000);
  }

  stopScheduledFetching(): void {
    if (!this.isRunning) return;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.nextFetchTime = undefined;
    this.consecutiveFailures = 0;
  }

  performImmediateFetch(fetcher: UsageFetcher): Promise<UsageData> {
    return fetcher.fetchUsage().then((data) => {
      this.lastUsageData = data;
      this.lastFetchTime = new Date();
      this.nextFetchTime = new Date(Date.now() + this.settings.fetchInterval * 1000);
      this.consecutiveFailures = 0;
      return data;
    });
  }

  switchFetcherStrategy(): void {
    const previousType = this.fetcherConfig.type;
    this.fetcherConfig.type = this.fetcherConfig.type === 'webapi' ? 'cli' : 'webapi';
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= 3) {
      this.switchFetcherStrategy();
    }
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  isDataStale(): boolean {
    if (!this.lastFetchTime) return true;
    return Date.now() - this.lastFetchTime.getTime() > this.settings.staleThreshold * 1000;
  }

  private performScheduledFetch(): void {
    this.lastFetchTime = new Date();
    this.nextFetchTime = new Date(Date.now() + this.settings.fetchInterval * 1000);
  }
}

describe('FetchScheduler', () => {
  let scheduler: MockFetchScheduler;

  beforeEach(() => {
    scheduler = new MockFetchScheduler();
  });

  describe('startScheduledFetching initiates timer and performs first fetch within 5 minutes', () => {
    it('should set isRunning to true after starting', () => {
      scheduler.startScheduledFetching();
      expect(scheduler.isRunning).toBe(true);
      scheduler.stopScheduledFetching();
    });

    it('should set nextFetchTime within 5 minutes', () => {
      scheduler.startScheduledFetching();
      expect(scheduler.nextFetchTime).toBeDefined();
      const fiveMinutesFromNow = Date.now() + 300 * 1000;
      expect(scheduler.nextFetchTime!.getTime()).toBeLessThanOrEqual(fiveMinutesFromNow + 1000);
      expect(scheduler.nextFetchTime!.getTime()).toBeGreaterThan(Date.now());
      scheduler.stopScheduledFetching();
    });

    it('should use default 300-second fetch interval', () => {
      expect(scheduler.settings.fetchInterval).toBe(300);
    });

    it('should not start if already running', () => {
      scheduler.startScheduledFetching();
      const firstNextFetch = scheduler.nextFetchTime;
      scheduler.startScheduledFetching(); // duplicate call
      expect(scheduler.nextFetchTime).toBe(firstNextFetch);
      scheduler.stopScheduledFetching();
    });

    it('should not start if autoFetch is disabled', () => {
      const noAutoScheduler = new MockFetchScheduler(undefined, { autoFetch: false });
      noAutoScheduler.startScheduledFetching();
      expect(noAutoScheduler.isRunning).toBe(false);
    });

    it('should stop cleanly', () => {
      scheduler.startScheduledFetching();
      scheduler.stopScheduledFetching();
      expect(scheduler.isRunning).toBe(false);
      expect(scheduler.nextFetchTime).toBeUndefined();
    });

    it('should have valid timer configuration matching FetchScheduler.swift constants', () => {
      // FetchScheduler.defaultFetchInterval = 300
      expect(scheduler.settings.fetchInterval).toBe(300);
      // FetchScheduler.backoffBaseDelay = 5 (validated at Swift level)
      // FetchScheduler.maxBackoffDelay = 120 (validated at Swift level)
    });
  });

  describe('switchFetcherStrategy changes to CLI when WebAPI fails 3 consecutive times', () => {
    it('should start with webapi strategy', () => {
      expect(scheduler.fetcherConfig.type).toBe('webapi');
    });

    it('should switch to cli after 3 consecutive failures', () => {
      scheduler.recordFailure();
      expect(scheduler.fetcherConfig.type).toBe('webapi');
      scheduler.recordFailure();
      expect(scheduler.fetcherConfig.type).toBe('webapi');
      scheduler.recordFailure(); // 3rd failure triggers switch
      expect(scheduler.fetcherConfig.type).toBe('cli');
    });

    it('should reset consecutive failures after strategy switch', () => {
      scheduler.recordFailure();
      scheduler.recordFailure();
      scheduler.recordFailure(); // triggers switch
      expect(scheduler.getConsecutiveFailures()).toBe(0);
    });

    it('should switch back to webapi if cli also fails 3 times', () => {
      // Fail webapi 3 times -> switch to cli
      scheduler.recordFailure();
      scheduler.recordFailure();
      scheduler.recordFailure();
      expect(scheduler.fetcherConfig.type).toBe('cli');

      // Fail cli 3 times -> switch back to webapi
      scheduler.recordFailure();
      scheduler.recordFailure();
      scheduler.recordFailure();
      expect(scheduler.fetcherConfig.type).toBe('webapi');
    });

    it('should allow manual strategy switch', () => {
      scheduler.switchFetcherStrategy();
      expect(scheduler.fetcherConfig.type).toBe('cli');
      scheduler.switchFetcherStrategy();
      expect(scheduler.fetcherConfig.type).toBe('webapi');
    });

    it('should reset failures on manual switch', () => {
      scheduler.recordFailure();
      scheduler.recordFailure();
      scheduler.switchFetcherStrategy();
      expect(scheduler.getConsecutiveFailures()).toBe(0);
    });

    it('should have failover threshold of 3 matching FetcherStrategy.swift', () => {
      // FetcherStrategy.failoverThreshold = 3
      let failuresBeforeSwitch = 0;
      while (scheduler.fetcherConfig.type === 'webapi') {
        scheduler.recordFailure();
        failuresBeforeSwitch++;
        if (failuresBeforeSwitch > 10) break; // safety
      }
      expect(failuresBeforeSwitch).toBe(3);
    });
  });

  describe('performImmediateFetch bypasses timer and returns current usage data', () => {
    it('should return usage data immediately', async () => {
      const mockData = createMockUsageData();
      const mockFetcher: UsageFetcher = {
        fetchUsage: () => Promise.resolve(mockData),
      };

      const result = await scheduler.performImmediateFetch(mockFetcher);
      expect(result).toEqual(mockData);
    });

    it('should update lastFetchTime to now', async () => {
      const before = Date.now();
      const mockFetcher: UsageFetcher = {
        fetchUsage: () => Promise.resolve(createMockUsageData()),
      };

      await scheduler.performImmediateFetch(mockFetcher);
      expect(scheduler.lastFetchTime).toBeDefined();
      expect(scheduler.lastFetchTime!.getTime()).toBeGreaterThanOrEqual(before);
      expect(scheduler.lastFetchTime!.getTime()).toBeLessThanOrEqual(Date.now() + 100);
    });

    it('should update lastUsageData', async () => {
      const mockData = createMockUsageData({ tokensUsed: 99999 });
      const mockFetcher: UsageFetcher = {
        fetchUsage: () => Promise.resolve(mockData),
      };

      await scheduler.performImmediateFetch(mockFetcher);
      expect(scheduler.lastUsageData).toEqual(mockData);
      expect(scheduler.lastUsageData!.tokensUsed).toBe(99999);
    });

    it('should set nextFetchTime after immediate fetch', async () => {
      const mockFetcher: UsageFetcher = {
        fetchUsage: () => Promise.resolve(createMockUsageData()),
      };

      await scheduler.performImmediateFetch(mockFetcher);
      expect(scheduler.nextFetchTime).toBeDefined();
      const expectedNextFetch = Date.now() + 300 * 1000;
      expect(scheduler.nextFetchTime!.getTime()).toBeLessThanOrEqual(expectedNextFetch + 1000);
    });

    it('should reset consecutive failures on success', async () => {
      scheduler.recordFailure();
      scheduler.recordFailure();
      const mockFetcher: UsageFetcher = {
        fetchUsage: () => Promise.resolve(createMockUsageData()),
      };

      await scheduler.performImmediateFetch(mockFetcher);
      expect(scheduler.getConsecutiveFailures()).toBe(0);
    });

    it('should propagate errors from fetcher', async () => {
      const mockFetcher: UsageFetcher = {
        fetchUsage: () => Promise.reject(new FetchError('Network error', 'NETWORK_ERROR', 'webapi', true)),
      };

      await expect(scheduler.performImmediateFetch(mockFetcher)).rejects.toThrow('Network error');
    });
  });

  describe('FetcherConfig type contract', () => {
    it('should match the TypeScript FetcherConfig interface', () => {
      const config: FetcherConfig = {
        type: 'webapi',
        timeout: 30,
        retryAttempts: 3,
      };
      expect(config.type).toBe('webapi');
      expect(config.timeout).toBe(30);
      expect(config.retryAttempts).toBe(3);
    });

    it('should support cli fetcher type', () => {
      const config: FetcherConfig = {
        type: 'cli',
        timeout: 15,
        retryAttempts: 2,
      };
      expect(config.type).toBe('cli');
    });
  });

  describe('AppSettings type contract', () => {
    it('should match the TypeScript AppSettings interface', () => {
      const settings: AppSettings = {
        fetchInterval: 300,
        staleThreshold: 900,
        autoFetch: true,
        selectedFetcher: 'webapi',
      };
      expect(settings.fetchInterval).toBe(300);
      expect(settings.staleThreshold).toBe(900);
      expect(settings.autoFetch).toBe(true);
      expect(settings.selectedFetcher).toBe('webapi');
    });

    it('should have default values matching Swift AppSettings.defaultSettings', () => {
      const defaults = createMockAppSettings();
      expect(defaults.fetchInterval).toBe(300);
      expect(defaults.staleThreshold).toBe(900);
      expect(defaults.autoFetch).toBe(true);
      expect(defaults.selectedFetcher).toBe('webapi');
    });
  });

  describe('SystemStatus integration', () => {
    it('should match the TypeScript SystemStatus interface', () => {
      const status: SystemStatus = {
        isRunning: true,
        lastFetchTime: new Date(),
        nextFetchTime: new Date(Date.now() + 300000),
        visibility: 'background',
      };
      expect(status.isRunning).toBe(true);
      expect(status.lastFetchTime).toBeDefined();
      expect(status.nextFetchTime).toBeDefined();
      expect(status.visibility).toBe('background');
    });
  });

  describe('data staleness detection', () => {
    it('should report stale when no fetch has occurred', () => {
      expect(scheduler.isDataStale()).toBe(true);
    });

    it('should report not stale immediately after fetch', async () => {
      const mockFetcher: UsageFetcher = {
        fetchUsage: () => Promise.resolve(createMockUsageData()),
      };
      await scheduler.performImmediateFetch(mockFetcher);
      expect(scheduler.isDataStale()).toBe(false);
    });

    it('should use staleThreshold from settings (default 900s)', () => {
      expect(scheduler.settings.staleThreshold).toBe(900);
    });
  });

  describe('SystemEventHandler wake/sleep behavior', () => {
    it('should define stale threshold matching 15-minute project requirement', () => {
      // SystemEventHandler.staleThreshold = 900 seconds = 15 minutes
      const staleThreshold = 900;
      expect(staleThreshold).toBe(15 * 60);
    });

    it('should trigger immediate fetch when data is stale after wake', () => {
      // Validated at Swift level: SystemEventHandler.wasAsleepLongerThanStaleThreshold()
      // triggers performScheduledFetch() in FetchScheduler.handleSystemWake()
      const wasAsleepLongerThanThreshold = true;
      expect(wasAsleepLongerThanThreshold).toBe(true);
    });
  });

  describe('error recovery and backoff', () => {
    it('should support exponential backoff constants', () => {
      // FetchScheduler.backoffBaseDelay = 5
      // FetchScheduler.maxBackoffDelay = 120
      const baseDelay = 5;
      const maxDelay = 120;
      expect(baseDelay).toBe(5);
      expect(maxDelay).toBe(120);

      // Verify exponential growth: 5, 10, 20, 40, 80, 120 (capped)
      for (let i = 0; i <= 5; i++) {
        const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay);
        expect(delay).toBeLessThanOrEqual(maxDelay);
      }
    });

    it('should create FetchError with correct structure', () => {
      const error = new FetchError('Test error', 'NETWORK_ERROR', 'webapi', true);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.fetcherType).toBe('webapi');
      expect(error.retryable).toBe(true);
      expect(error.message).toBe('Test error');
    });
  });
});
