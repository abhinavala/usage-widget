import { describe, it, expect } from 'vitest';

// TypeScript mirror types matching the Swift implementation
// These mirror the Swift types from ClaudeUsageWidget.swift and UsageData.swift

interface UsageData {
  tokensUsed: number;
  tokensLimit: number;
  requestsUsed: number;
  requestsLimit: number;
  resetTime: string;
  lastUpdated: string;
}

interface ProgressBarConfiguration {
  lowThreshold: number;
  mediumThreshold: number;
  highThreshold: number;
  colors: ProgressColors;
}

interface ProgressColors {
  low: string;
  medium: string;
  high: string;
  background: string;
}

enum WidgetSize {
  Small = 'small',
  Medium = 'medium',
}

interface WidgetConfiguration {
  size: WidgetSize;
}

interface WidgetEntry {
  date: Date;
  usageData: UsageData | null;
  configuration: WidgetConfiguration;
}

type UsageType = 'tokens' | 'requests';

// Logic functions mirroring Swift SmallWidgetView behavior

function priorityUsageType(usageData: UsageData): UsageType {
  const tokenPercentage =
    usageData.tokensLimit > 0
      ? (usageData.tokensUsed / usageData.tokensLimit) * 100
      : 0;
  const requestPercentage =
    usageData.requestsLimit > 0
      ? (usageData.requestsUsed / usageData.requestsLimit) * 100
      : 0;

  return tokenPercentage >= requestPercentage ? 'tokens' : 'requests';
}

function usagePercentage(usageData: UsageData, type: UsageType): number {
  if (type === 'tokens') {
    if (usageData.tokensLimit <= 0) return 0;
    return Math.min((usageData.tokensUsed / usageData.tokensLimit) * 100, 100);
  } else {
    if (usageData.requestsLimit <= 0) return 0;
    return Math.min(
      (usageData.requestsUsed / usageData.requestsLimit) * 100,
      100
    );
  }
}

function colorForPercentage(
  percentage: number,
  config: ProgressBarConfiguration
): string {
  if (percentage < config.lowThreshold) {
    return config.colors.low;
  } else if (percentage > config.highThreshold) {
    return config.colors.high;
  } else {
    return config.colors.medium;
  }
}

function formattedResetTime(resetTime: string): string {
  const now = new Date();
  const resetDate = new Date(resetTime);
  const intervalMs = resetDate.getTime() - now.getTime();

  if (intervalMs <= 0) return 'soon';

  const totalMinutes = Math.floor(intervalMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  } else if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  } else {
    return `in ${minutes}m`;
  }
}

interface SmallWidgetRenderResult {
  hasData: boolean;
  percentage?: number;
  label?: string;
  color?: string;
  resetTimeText?: string;
  noDataText?: string;
}

function renderSmallWidget(
  entry: WidgetEntry,
  progressConfig: ProgressBarConfiguration
): SmallWidgetRenderResult {
  if (!entry.usageData) {
    return {
      hasData: false,
      noDataText: 'No Data',
    };
  }

  const data = entry.usageData;
  const priority = priorityUsageType(data);
  const pct = usagePercentage(data, priority);
  const label = priority === 'tokens' ? 'Tokens' : 'Requests';
  const color = colorForPercentage(pct, progressConfig);
  const resetText = formattedResetTime(data.resetTime);

  return {
    hasData: true,
    percentage: Math.round(pct),
    label,
    color,
    resetTimeText: `Resets ${resetText}`,
  };
}

// Default progress bar configuration matching Swift thresholds
const defaultProgressConfig: ProgressBarConfiguration = {
  lowThreshold: 50,
  mediumThreshold: 65,
  highThreshold: 80,
  colors: {
    low: '#34C759', // green
    medium: '#FF9500', // orange
    high: '#FF3B30', // red
    background: '#E5E5EA', // systemGray5
  },
};

describe('SmallWidgetView', () => {
  describe('displays token usage when tokens have higher priority', () => {
    it('shows token percentage, progress bar with correct color, and formatted reset time', () => {
      const futureDate = new Date(Date.now() + 4 * 3600 * 1000);
      const entry: WidgetEntry = {
        date: new Date(),
        usageData: {
          tokensUsed: 65_000,
          tokensLimit: 100_000,
          requestsUsed: 10,
          requestsLimit: 100,
          resetTime: futureDate.toISOString(),
          lastUpdated: new Date().toISOString(),
        },
        configuration: { size: WidgetSize.Small },
      };

      const result = renderSmallWidget(entry, defaultProgressConfig);

      expect(result.hasData).toBe(true);
      expect(result.percentage).toBe(65);
      expect(result.label).toBe('Tokens');
      // 65% is between lowThreshold (50) and highThreshold (80) → medium/orange
      expect(result.color).toBe(defaultProgressConfig.colors.medium);
      expect(result.resetTimeText).toContain('Resets in');
      expect(result.resetTimeText).toContain('h');
    });

    it('shows green color for low token usage', () => {
      const entry: WidgetEntry = {
        date: new Date(),
        usageData: {
          tokensUsed: 20_000,
          tokensLimit: 100_000,
          requestsUsed: 5,
          requestsLimit: 100,
          resetTime: new Date(Date.now() + 3600_000).toISOString(),
          lastUpdated: new Date().toISOString(),
        },
        configuration: { size: WidgetSize.Small },
      };

      const result = renderSmallWidget(entry, defaultProgressConfig);

      expect(result.percentage).toBe(20);
      expect(result.label).toBe('Tokens');
      expect(result.color).toBe(defaultProgressConfig.colors.low);
    });

    it('shows red color for high token usage', () => {
      const entry: WidgetEntry = {
        date: new Date(),
        usageData: {
          tokensUsed: 95_000,
          tokensLimit: 100_000,
          requestsUsed: 5,
          requestsLimit: 100,
          resetTime: new Date(Date.now() + 3600_000).toISOString(),
          lastUpdated: new Date().toISOString(),
        },
        configuration: { size: WidgetSize.Small },
      };

      const result = renderSmallWidget(entry, defaultProgressConfig);

      expect(result.percentage).toBe(95);
      expect(result.color).toBe(defaultProgressConfig.colors.high);
    });
  });

  describe('shows no data state when UsageData is null', () => {
    it('displays No Data text with appropriate styling and no progress indicators', () => {
      const entry: WidgetEntry = {
        date: new Date(),
        usageData: null,
        configuration: { size: WidgetSize.Small },
      };

      const result = renderSmallWidget(entry, defaultProgressConfig);

      expect(result.hasData).toBe(false);
      expect(result.noDataText).toBe('No Data');
      expect(result.percentage).toBeUndefined();
      expect(result.color).toBeUndefined();
      expect(result.resetTimeText).toBeUndefined();
    });
  });

  describe('priorityUsageType returns correct usage type based on percentage comparison', () => {
    it('returns tokens when token percentage > request percentage', () => {
      const data: UsageData = {
        tokensUsed: 80_000,
        tokensLimit: 100_000,
        requestsUsed: 20,
        requestsLimit: 100,
        resetTime: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      expect(priorityUsageType(data)).toBe('tokens');
    });

    it('returns requests when request percentage > token percentage', () => {
      const data: UsageData = {
        tokensUsed: 10_000,
        tokensLimit: 100_000,
        requestsUsed: 80,
        requestsLimit: 100,
        resetTime: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      expect(priorityUsageType(data)).toBe('requests');
    });

    it('returns tokens when percentages are equal', () => {
      const data: UsageData = {
        tokensUsed: 50_000,
        tokensLimit: 100_000,
        requestsUsed: 50,
        requestsLimit: 100,
        resetTime: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      expect(priorityUsageType(data)).toBe('tokens');
    });

    it('handles zero limits gracefully', () => {
      const data: UsageData = {
        tokensUsed: 0,
        tokensLimit: 0,
        requestsUsed: 50,
        requestsLimit: 100,
        resetTime: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      // token percentage is 0, request percentage is 50 → requests
      expect(priorityUsageType(data)).toBe('requests');
    });
  });

  describe('usagePercentage', () => {
    it('calculates token percentage correctly', () => {
      const data: UsageData = {
        tokensUsed: 75_000,
        tokensLimit: 100_000,
        requestsUsed: 0,
        requestsLimit: 100,
        resetTime: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      expect(usagePercentage(data, 'tokens')).toBe(75);
    });

    it('caps percentage at 100', () => {
      const data: UsageData = {
        tokensUsed: 150_000,
        tokensLimit: 100_000,
        requestsUsed: 0,
        requestsLimit: 100,
        resetTime: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      expect(usagePercentage(data, 'tokens')).toBe(100);
    });

    it('returns 0 when limit is 0', () => {
      const data: UsageData = {
        tokensUsed: 1000,
        tokensLimit: 0,
        requestsUsed: 0,
        requestsLimit: 0,
        resetTime: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      expect(usagePercentage(data, 'tokens')).toBe(0);
      expect(usagePercentage(data, 'requests')).toBe(0);
    });
  });

  describe('formattedResetTime', () => {
    it('returns "soon" for past dates', () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      expect(formattedResetTime(pastDate)).toBe('soon');
    });

    it('formats minutes for short durations', () => {
      const futureDate = new Date(Date.now() + 30 * 60_000).toISOString();
      const result = formattedResetTime(futureDate);
      expect(result).toMatch(/^in \d+m$/);
    });

    it('formats hours and minutes', () => {
      const futureDate = new Date(Date.now() + 4 * 3600_000 + 30 * 60_000).toISOString();
      const result = formattedResetTime(futureDate);
      expect(result).toMatch(/^in \d+h \d+m$/);
    });

    it('formats days for long durations', () => {
      const futureDate = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();
      const result = formattedResetTime(futureDate);
      expect(result).toMatch(/^in \d+d$/);
    });
  });

  describe('colorForPercentage', () => {
    it('returns low color below lowThreshold', () => {
      expect(colorForPercentage(30, defaultProgressConfig)).toBe(
        defaultProgressConfig.colors.low
      );
    });

    it('returns medium color between thresholds', () => {
      expect(colorForPercentage(65, defaultProgressConfig)).toBe(
        defaultProgressConfig.colors.medium
      );
    });

    it('returns high color above highThreshold', () => {
      expect(colorForPercentage(90, defaultProgressConfig)).toBe(
        defaultProgressConfig.colors.high
      );
    });
  });
});
