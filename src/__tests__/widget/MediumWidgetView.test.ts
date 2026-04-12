import { describe, it, expect } from 'vitest';
import { UsageData } from '../../types/usage';
import { ProgressBarConfiguration, ProgressColors } from '../../types/ui';
import { TimelineConfiguration, WidgetSize, WidgetEntry, WidgetConfiguration } from '../../types/widget';
import { calculateUsagePercentages } from '../../utils/usageCalculations';

// --- Widget logic functions (mirroring MediumWidgetView.swift helpers) ---

function progressColor(percentage: number, config: ProgressBarConfiguration): string {
  if (percentage >= config.highThreshold) return config.colors.critical;
  if (percentage >= config.mediumThreshold) return config.colors.high;
  if (percentage >= config.lowThreshold) return config.colors.medium;
  return config.colors.low;
}

function isDataStale(
  lastUpdated: Date,
  now: Date,
  staleThresholdMinutes: number = 15,
): boolean {
  const elapsed = now.getTime() - lastUpdated.getTime();
  return elapsed > staleThresholdMinutes * 60 * 1000;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

// --- Default configuration ---

const defaultProgressConfig: ProgressBarConfiguration = {
  lowThreshold: 0.50,
  mediumThreshold: 0.75,
  highThreshold: 0.90,
  colors: {
    low: 'green',
    medium: 'yellow',
    high: 'orange',
    critical: 'red',
  },
};

const defaultTimelineConfig: TimelineConfiguration = {
  refreshInterval: 60,
  maxEntries: 60,
  staleThreshold: 15,
};

// --- Helper to build test usage data ---

function makeUsageData(overrides: Partial<UsageData> = {}): UsageData {
  return {
    tokensUsed: 500_000,
    tokensLimit: 1_000_000,
    messagesUsed: 25,
    messagesLimit: 50,
    resetTime: new Date('2026-04-11T15:00:00Z'),
    lastUpdated: new Date(),
    ...overrides,
  };
}

// ===================== Tests =====================

describe('MediumWidgetView', () => {
  describe('displays both token and request usage with correct percentages', () => {
    it('calculates token and message percentages correctly', () => {
      const data = makeUsageData({
        tokensUsed: 750_000,
        tokensLimit: 1_000_000,
        messagesUsed: 42,
        messagesLimit: 50,
      });
      const percentages = calculateUsagePercentages(data);

      expect(percentages.tokensPercentage).toBeCloseTo(75, 0);
      expect(percentages.messagesPercentage).toBeCloseTo(84, 0);
    });

    it('handles zero limits without division errors', () => {
      const data = makeUsageData({ tokensLimit: 0, messagesLimit: 0 });
      const percentages = calculateUsagePercentages(data);

      expect(percentages.tokensPercentage).toBe(0);
      expect(percentages.messagesPercentage).toBe(0);
    });

    it('handles usage at exactly 100%', () => {
      const data = makeUsageData({
        tokensUsed: 1_000_000,
        tokensLimit: 1_000_000,
        messagesUsed: 50,
        messagesLimit: 50,
      });
      const percentages = calculateUsagePercentages(data);

      expect(percentages.tokensPercentage).toBe(100);
      expect(percentages.messagesPercentage).toBe(100);
    });

    it('handles usage exceeding limit', () => {
      const data = makeUsageData({
        tokensUsed: 1_200_000,
        tokensLimit: 1_000_000,
      });
      const percentages = calculateUsagePercentages(data);

      expect(percentages.tokensPercentage).toBe(120);
    });
  });

  describe('isDataStale returns true when lastUpdated exceeds stale threshold', () => {
    it('returns false when data is fresh (under 15 minutes)', () => {
      const now = new Date('2026-04-11T12:00:00Z');
      const lastUpdated = new Date('2026-04-11T11:50:00Z'); // 10 min ago

      expect(isDataStale(lastUpdated, now)).toBe(false);
    });

    it('returns true when data is stale (over 15 minutes)', () => {
      const now = new Date('2026-04-11T12:00:00Z');
      const lastUpdated = new Date('2026-04-11T11:40:00Z'); // 20 min ago

      expect(isDataStale(lastUpdated, now)).toBe(true);
    });

    it('returns false at exactly 15 minutes (boundary)', () => {
      const now = new Date('2026-04-11T12:00:00Z');
      const lastUpdated = new Date('2026-04-11T11:45:00Z'); // exactly 15 min

      expect(isDataStale(lastUpdated, now)).toBe(false);
    });

    it('returns true at 15 minutes and 1 second', () => {
      const now = new Date('2026-04-11T12:00:00Z');
      const lastUpdated = new Date('2026-04-11T11:44:59Z'); // 15 min 1 sec ago

      expect(isDataStale(lastUpdated, now)).toBe(true);
    });

    it('respects custom stale threshold', () => {
      const now = new Date('2026-04-11T12:00:00Z');
      const lastUpdated = new Date('2026-04-11T11:55:00Z'); // 5 min ago

      expect(isDataStale(lastUpdated, now, 3)).toBe(true);
      expect(isDataStale(lastUpdated, now, 10)).toBe(false);
    });

    it('uses timeline config stale threshold', () => {
      const now = new Date('2026-04-11T12:00:00Z');
      const lastUpdated = new Date('2026-04-11T11:40:00Z'); // 20 min ago

      expect(isDataStale(lastUpdated, now, defaultTimelineConfig.staleThreshold)).toBe(true);
    });
  });

  describe('progressColor returns correct color based on usage percentage and thresholds', () => {
    it('returns low color for usage under 50%', () => {
      expect(progressColor(0.0, defaultProgressConfig)).toBe('green');
      expect(progressColor(0.25, defaultProgressConfig)).toBe('green');
      expect(progressColor(0.49, defaultProgressConfig)).toBe('green');
    });

    it('returns medium color for usage between 50% and 75%', () => {
      expect(progressColor(0.50, defaultProgressConfig)).toBe('yellow');
      expect(progressColor(0.60, defaultProgressConfig)).toBe('yellow');
      expect(progressColor(0.74, defaultProgressConfig)).toBe('yellow');
    });

    it('returns high color for usage between 75% and 90%', () => {
      expect(progressColor(0.75, defaultProgressConfig)).toBe('orange');
      expect(progressColor(0.80, defaultProgressConfig)).toBe('orange');
      expect(progressColor(0.89, defaultProgressConfig)).toBe('orange');
    });

    it('returns critical color for usage at or above 90%', () => {
      expect(progressColor(0.90, defaultProgressConfig)).toBe('red');
      expect(progressColor(0.95, defaultProgressConfig)).toBe('red');
      expect(progressColor(1.0, defaultProgressConfig)).toBe('red');
    });

    it('returns critical color for usage over 100%', () => {
      expect(progressColor(1.2, defaultProgressConfig)).toBe('red');
    });

    it('works with custom thresholds', () => {
      const customConfig: ProgressBarConfiguration = {
        lowThreshold: 0.30,
        mediumThreshold: 0.60,
        highThreshold: 0.80,
        colors: { low: 'blue', medium: 'purple', high: 'pink', critical: 'black' },
      };
      expect(progressColor(0.20, customConfig)).toBe('blue');
      expect(progressColor(0.40, customConfig)).toBe('purple');
      expect(progressColor(0.70, customConfig)).toBe('pink');
      expect(progressColor(0.85, customConfig)).toBe('black');
    });
  });

  describe('formatNumber', () => {
    it('formats numbers under 1000 as-is', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(42)).toBe('42');
      expect(formatNumber(999)).toBe('999');
    });

    it('formats thousands with K suffix', () => {
      expect(formatNumber(1_000)).toBe('1.0K');
      expect(formatNumber(50_000)).toBe('50.0K');
      expect(formatNumber(999_999)).toBe('1000.0K');
    });

    it('formats millions with M suffix', () => {
      expect(formatNumber(1_000_000)).toBe('1.0M');
      expect(formatNumber(5_500_000)).toBe('5.5M');
    });
  });

  describe('widget entry structure', () => {
    it('supports null usageData for placeholder state', () => {
      const entry: WidgetEntry = {
        date: new Date(),
        usageData: null,
        configuration: { size: WidgetSize.Medium },
      };
      expect(entry.usageData).toBeNull();
      expect(entry.configuration.size).toBe(WidgetSize.Medium);
    });

    it('supports medium widget size enum', () => {
      expect(WidgetSize.Medium).toBe('medium');
      expect(WidgetSize.Small).toBe('small');
    });
  });
});
