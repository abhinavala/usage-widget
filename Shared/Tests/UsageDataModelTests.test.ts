import { describe, it, expect, beforeEach } from 'vitest';
import type { UsageData, ManualOverride } from '../../src/types/usage';

interface UsageDataWithOverride extends UsageData {
  manualOverride: ManualOverride;
}

function createUsageData(data: UsageData): UsageDataWithOverride {
  return { ...data, manualOverride: { enabled: false } };
}

function isUsingOverrides(data: UsageDataWithOverride): boolean {
  return data.manualOverride.enabled;
}

function applyManualOverride(
  data: UsageDataWithOverride,
  override: ManualOverride
): UsageDataWithOverride {
  return { ...data, manualOverride: override };
}

function getEffectiveUsage(data: UsageDataWithOverride): UsageData {
  if (!data.manualOverride.enabled) {
    const { manualOverride: _, ...usage } = data;
    return usage;
  }

  const result = { ...data };
  if (data.manualOverride.inputPercentage !== undefined) {
    result.inputTokens = Math.floor(
      data.inputLimit * data.manualOverride.inputPercentage / 100
    );
  }
  if (data.manualOverride.outputPercentage !== undefined) {
    result.outputTokens = Math.floor(
      data.outputLimit * data.manualOverride.outputPercentage / 100
    );
  }
  if (data.manualOverride.resetTime !== undefined) {
    result.resetTime = data.manualOverride.resetTime;
  }
  result.lastUpdated = new Date();

  const { manualOverride: _, ...usage } = result;
  return usage;
}

describe('UsageDataModelTests', () => {
  let baseData: UsageDataWithOverride;
  const now = new Date('2026-04-11T12:00:00Z');
  const resetDate = new Date('2026-04-12T00:00:00Z');

  beforeEach(() => {
    baseData = createUsageData({
      inputTokens: 5000,
      outputTokens: 3000,
      inputLimit: 10000,
      outputLimit: 8000,
      resetTime: resetDate,
      lastUpdated: now,
    });
  });

  it('getEffectiveUsage returns override values when manual override is enabled', () => {
    const override: ManualOverride = {
      enabled: true,
      inputPercentage: 75,
      outputPercentage: 50,
    };
    const withOverride = applyManualOverride(baseData, override);
    const effective = getEffectiveUsage(withOverride);

    expect(effective.inputTokens).toBe(Math.floor(10000 * 75 / 100));
    expect(effective.outputTokens).toBe(Math.floor(8000 * 50 / 100));
    expect(isUsingOverrides(withOverride)).toBe(true);
  });

  it('applyManualOverride preserves original fetched data', () => {
    const override: ManualOverride = {
      enabled: true,
      inputPercentage: 90,
      outputPercentage: 60,
    };
    const withOverride = applyManualOverride(baseData, override);

    expect(withOverride.inputTokens).toBe(5000);
    expect(withOverride.outputTokens).toBe(3000);
    expect(withOverride.inputLimit).toBe(10000);
    expect(withOverride.outputLimit).toBe(8000);
    expect(withOverride.resetTime).toEqual(resetDate);
    expect(withOverride.manualOverride).toEqual(override);
  });

  it('isUsingOverrides returns false when override is disabled', () => {
    expect(isUsingOverrides(baseData)).toBe(false);

    const disabledOverride: ManualOverride = {
      enabled: false,
      inputPercentage: 50,
    };
    const withDisabled = applyManualOverride(baseData, disabledOverride);

    expect(isUsingOverrides(withDisabled)).toBe(false);

    const effective = getEffectiveUsage(withDisabled);
    expect(effective.inputTokens).toBe(5000);
    expect(effective.outputTokens).toBe(3000);
  });

  it('getEffectiveUsage returns original data when no override is active', () => {
    const effective = getEffectiveUsage(baseData);

    expect(effective.inputTokens).toBe(5000);
    expect(effective.outputTokens).toBe(3000);
    expect(effective.inputLimit).toBe(10000);
    expect(effective.outputLimit).toBe(8000);
  });

  it('override resetTime is applied in effective usage', () => {
    const customReset = new Date('2026-04-15T00:00:00Z');
    const override: ManualOverride = {
      enabled: true,
      resetTime: customReset,
    };
    const withOverride = applyManualOverride(baseData, override);
    const effective = getEffectiveUsage(withOverride);

    expect(effective.resetTime).toEqual(customReset);
  });
});
