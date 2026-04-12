import { describe, it, expect, beforeEach } from 'vitest';

// TypeScript equivalents of the Swift types for testing business logic

interface UsageData {
  inputTokens: number;
  outputTokens: number;
  inputLimit: number;
  outputLimit: number;
  resetTime: Date;
  lastUpdated: Date;
  manualOverride?: ManualOverride;
}

interface ManualOverride {
  enabled: boolean;
  inputPercentage?: number;
  outputPercentage?: number;
  resetTime?: Date;
  createdAt: Date;
}

type FetchSource = 'webapi' | 'cli' | 'manual' | 'cache';

interface EffectiveUsageResult {
  usageData: UsageData;
  source: FetchSource;
}

class OverrideValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverrideValidationError';
  }
}

// TypeScript implementation mirroring ManualOverrideManager.swift logic

class ManualOverrideManager {
  readonly expirationInterval: number;

  constructor(expirationIntervalMs: number = 24 * 60 * 60 * 1000) {
    this.expirationInterval = expirationIntervalMs;
  }

  calculateEffectiveUsage(
    base: UsageData,
    source: FetchSource,
    now: Date = new Date()
  ): EffectiveUsageResult {
    const override = base.manualOverride;
    if (!override || !override.enabled || this.isOverrideExpired(override, now)) {
      return { usageData: base, source };
    }

    const effective = this.getEffectiveUsage(base);
    return { usageData: effective, source: 'manual' };
  }

  getDataProvenance(
    usageData: UsageData,
    originalSource: FetchSource,
    now: Date = new Date()
  ): FetchSource {
    const override = usageData.manualOverride;
    if (!override || !override.enabled || this.isOverrideExpired(override, now)) {
      return originalSource;
    }
    return 'manual';
  }

  validateOverrideValues(override: ManualOverride): void {
    if (override.inputPercentage !== undefined) {
      if (override.inputPercentage < 0 || override.inputPercentage > 100) {
        throw new OverrideValidationError('Percentage must be between 0 and 100');
      }
    }
    if (override.outputPercentage !== undefined) {
      if (override.outputPercentage < 0 || override.outputPercentage > 100) {
        throw new OverrideValidationError('Percentage must be between 0 and 100');
      }
    }
    if (override.resetTime !== undefined) {
      if (override.resetTime <= new Date()) {
        throw new OverrideValidationError('Reset time must be in the future');
      }
    }
  }

  isOverrideExpired(override: ManualOverride, now: Date = new Date()): boolean {
    return now.getTime() - override.createdAt.getTime() >= this.expirationInterval;
  }

  applyOverride(override: ManualOverride, usageData: UsageData): UsageData {
    this.validateOverrideValues(override);
    return { ...usageData, manualOverride: override };
  }

  disableOverride(usageData: UsageData): UsageData {
    return {
      ...usageData,
      manualOverride: { enabled: false, createdAt: new Date() },
    };
  }

  resolveConflict(
    newFetchedData: UsageData,
    existingOverride: ManualOverride | undefined,
    now: Date = new Date()
  ): UsageData {
    if (!existingOverride || !existingOverride.enabled || this.isOverrideExpired(existingOverride, now)) {
      return newFetchedData;
    }
    return { ...newFetchedData, manualOverride: existingOverride };
  }

  handleReconnection(usageData: UsageData, now: Date = new Date()): UsageData {
    const override = usageData.manualOverride;
    if (!override || !override.enabled) {
      return usageData;
    }
    if (this.isOverrideExpired(override, now)) {
      return this.disableOverride(usageData);
    }
    return usageData;
  }

  private getEffectiveUsage(data: UsageData): UsageData {
    const override = data.manualOverride;
    if (!override || !override.enabled) return data;

    const effective = { ...data };
    if (override.inputPercentage !== undefined) {
      effective.inputTokens = Math.floor(data.inputLimit * override.inputPercentage / 100);
    }
    if (override.outputPercentage !== undefined) {
      effective.outputTokens = Math.floor(data.outputLimit * override.outputPercentage / 100);
    }
    if (override.resetTime !== undefined) {
      effective.resetTime = override.resetTime;
    }
    return effective;
  }
}

// Tests

describe('ManualOverrideLogicTests', () => {
  let manager: ManualOverrideManager;
  let baseUsageData: UsageData;
  const now = new Date('2026-04-11T12:00:00Z');

  beforeEach(() => {
    manager = new ManualOverrideManager();
    baseUsageData = {
      inputTokens: 50000,
      outputTokens: 30000,
      inputLimit: 200000,
      outputLimit: 100000,
      resetTime: new Date('2026-04-12T00:00:00Z'),
      lastUpdated: new Date('2026-04-11T11:50:00Z'),
    };
  });

  describe('calculateEffectiveUsage', () => {
    it('returns override-based values when override is enabled', () => {
      const override: ManualOverride = {
        enabled: true,
        inputPercentage: 75,
        outputPercentage: 50,
        createdAt: new Date('2026-04-11T11:00:00Z'),
      };
      const dataWithOverride: UsageData = {
        ...baseUsageData,
        manualOverride: override,
      };

      const result = manager.calculateEffectiveUsage(dataWithOverride, 'webapi', now);

      expect(result.usageData.inputTokens).toBe(
        Math.floor(baseUsageData.inputLimit * 75 / 100)
      );
      expect(result.usageData.outputTokens).toBe(
        Math.floor(baseUsageData.outputLimit * 50 / 100)
      );
      expect(result.source).toBe('manual');
      expect(manager.getDataProvenance(dataWithOverride, 'webapi', now)).toBe('manual');
    });

    it('returns original data when override is disabled', () => {
      const override: ManualOverride = {
        enabled: false,
        inputPercentage: 75,
        outputPercentage: 50,
        createdAt: new Date('2026-04-11T11:00:00Z'),
      };
      const dataWithOverride: UsageData = {
        ...baseUsageData,
        manualOverride: override,
      };

      const result = manager.calculateEffectiveUsage(dataWithOverride, 'webapi', now);

      expect(result.usageData).toEqual(dataWithOverride);
      expect(result.source).toBe('webapi');
      expect(manager.getDataProvenance(dataWithOverride, 'webapi', now)).toBe('webapi');
    });

    it('returns original data when no override is present', () => {
      const result = manager.calculateEffectiveUsage(baseUsageData, 'cli', now);

      expect(result.usageData).toEqual(baseUsageData);
      expect(result.source).toBe('cli');
    });

    it('returns original data when override is expired', () => {
      const expiredOverride: ManualOverride = {
        enabled: true,
        inputPercentage: 75,
        createdAt: new Date('2026-04-09T00:00:00Z'), // > 24h ago
      };
      const data: UsageData = {
        ...baseUsageData,
        manualOverride: expiredOverride,
      };

      const result = manager.calculateEffectiveUsage(data, 'webapi', now);

      expect(result.usageData).toEqual(data);
      expect(result.source).toBe('webapi');
    });
  });

  describe('validateOverrideValues', () => {
    it('throws error for input percentage above 100', () => {
      const override: ManualOverride = {
        enabled: true,
        inputPercentage: 150,
        createdAt: now,
      };

      expect(() => manager.validateOverrideValues(override)).toThrowError(
        'Percentage must be between 0 and 100'
      );
    });

    it('throws error for output percentage above 100', () => {
      const override: ManualOverride = {
        enabled: true,
        outputPercentage: 101,
        createdAt: now,
      };

      expect(() => manager.validateOverrideValues(override)).toThrowError(
        'Percentage must be between 0 and 100'
      );
    });

    it('throws error for negative percentage', () => {
      const override: ManualOverride = {
        enabled: true,
        inputPercentage: -5,
        createdAt: now,
      };

      expect(() => manager.validateOverrideValues(override)).toThrowError(
        'Percentage must be between 0 and 100'
      );
    });

    it('accepts valid percentage values', () => {
      const override: ManualOverride = {
        enabled: true,
        inputPercentage: 0,
        outputPercentage: 100,
        createdAt: now,
      };

      expect(() => manager.validateOverrideValues(override)).not.toThrow();
    });

    it('accepts override with no percentages set', () => {
      const override: ManualOverride = {
        enabled: true,
        createdAt: now,
      };

      expect(() => manager.validateOverrideValues(override)).not.toThrow();
    });
  });

  describe('isOverrideExpired', () => {
    it('returns false for recent override', () => {
      const override: ManualOverride = {
        enabled: true,
        createdAt: new Date('2026-04-11T11:00:00Z'),
      };

      expect(manager.isOverrideExpired(override, now)).toBe(false);
    });

    it('returns true for expired override', () => {
      const override: ManualOverride = {
        enabled: true,
        createdAt: new Date('2026-04-09T00:00:00Z'),
      };

      expect(manager.isOverrideExpired(override, now)).toBe(true);
    });

    it('respects custom expiration interval', () => {
      const shortManager = new ManualOverrideManager(60 * 60 * 1000); // 1 hour
      const override: ManualOverride = {
        enabled: true,
        createdAt: new Date('2026-04-11T10:30:00Z'), // 1.5 hours ago
      };

      expect(shortManager.isOverrideExpired(override, now)).toBe(true);
    });
  });

  describe('conflict resolution', () => {
    it('preserves active override on new fetched data', () => {
      const override: ManualOverride = {
        enabled: true,
        inputPercentage: 60,
        createdAt: new Date('2026-04-11T11:00:00Z'),
      };

      const newData: UsageData = {
        inputTokens: 80000,
        outputTokens: 40000,
        inputLimit: 200000,
        outputLimit: 100000,
        resetTime: new Date('2026-04-12T00:00:00Z'),
        lastUpdated: now,
      };

      const resolved = manager.resolveConflict(newData, override, now);

      expect(resolved.manualOverride).toEqual(override);
      expect(resolved.inputTokens).toBe(80000); // Base data preserved
    });

    it('uses new fetched data when no override exists', () => {
      const newData: UsageData = {
        inputTokens: 80000,
        outputTokens: 40000,
        inputLimit: 200000,
        outputLimit: 100000,
        resetTime: new Date('2026-04-12T00:00:00Z'),
        lastUpdated: now,
      };

      const resolved = manager.resolveConflict(newData, undefined, now);

      expect(resolved).toEqual(newData);
      expect(resolved.manualOverride).toBeUndefined();
    });

    it('drops expired override on conflict resolution', () => {
      const expiredOverride: ManualOverride = {
        enabled: true,
        inputPercentage: 60,
        createdAt: new Date('2026-04-09T00:00:00Z'),
      };

      const newData: UsageData = {
        ...baseUsageData,
        lastUpdated: now,
      };

      const resolved = manager.resolveConflict(newData, expiredOverride, now);

      expect(resolved.manualOverride).toBeUndefined();
    });
  });

  describe('handleReconnection', () => {
    it('removes expired override on reconnection', () => {
      const expiredOverride: ManualOverride = {
        enabled: true,
        inputPercentage: 50,
        createdAt: new Date('2026-04-09T00:00:00Z'),
      };
      const data: UsageData = {
        ...baseUsageData,
        manualOverride: expiredOverride,
      };

      const result = manager.handleReconnection(data, now);

      expect(result.manualOverride?.enabled).toBe(false);
    });

    it('preserves active override on reconnection', () => {
      const activeOverride: ManualOverride = {
        enabled: true,
        inputPercentage: 50,
        createdAt: new Date('2026-04-11T11:00:00Z'),
      };
      const data: UsageData = {
        ...baseUsageData,
        manualOverride: activeOverride,
      };

      const result = manager.handleReconnection(data, now);

      expect(result.manualOverride).toEqual(activeOverride);
    });

    it('returns data unchanged when no override present', () => {
      const result = manager.handleReconnection(baseUsageData, now);

      expect(result).toEqual(baseUsageData);
    });
  });

  describe('applyOverride', () => {
    it('applies valid override to usage data', () => {
      const override: ManualOverride = {
        enabled: true,
        inputPercentage: 80,
        outputPercentage: 60,
        createdAt: now,
      };

      const result = manager.applyOverride(override, baseUsageData);

      expect(result.manualOverride).toEqual(override);
    });

    it('rejects invalid override values', () => {
      const invalidOverride: ManualOverride = {
        enabled: true,
        inputPercentage: 200,
        createdAt: now,
      };

      expect(() => manager.applyOverride(invalidOverride, baseUsageData)).toThrowError(
        'Percentage must be between 0 and 100'
      );
    });
  });

  describe('disableOverride', () => {
    it('disables active override and reverts to base data', () => {
      const override: ManualOverride = {
        enabled: true,
        inputPercentage: 75,
        createdAt: now,
      };
      const data: UsageData = {
        ...baseUsageData,
        manualOverride: override,
      };

      const result = manager.disableOverride(data);

      expect(result.manualOverride?.enabled).toBe(false);
      expect(result.inputTokens).toBe(baseUsageData.inputTokens);
      expect(result.outputTokens).toBe(baseUsageData.outputTokens);
    });
  });
});
