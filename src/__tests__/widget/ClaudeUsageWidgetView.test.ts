import { describe, it, expect } from 'vitest';
import { WidgetSize, WidgetEntry, WidgetConfiguration } from '../../types/widget';
import { UsageData } from '../../types/usage';

// --- Routing logic functions (mirroring ClaudeUsageWidgetView.swift) ---

type WidgetFamily = 'systemSmall' | 'systemMedium' | 'systemLarge' | 'systemExtraLarge';

function widgetSize(family: WidgetFamily): WidgetSize | null {
  switch (family) {
    case 'systemSmall':
      return WidgetSize.Small;
    case 'systemMedium':
      return WidgetSize.Medium;
    default:
      return null;
  }
}

type ViewType = 'SmallWidgetView' | 'MediumWidgetView' | 'FallbackView';

interface RoutedView {
  type: ViewType;
  entry: WidgetEntry;
}

function viewForSize(size: WidgetSize | null, entry: WidgetEntry): RoutedView {
  switch (size) {
    case WidgetSize.Small:
      return { type: 'SmallWidgetView', entry };
    case WidgetSize.Medium:
      return { type: 'MediumWidgetView', entry };
    default:
      return { type: 'FallbackView', entry };
  }
}

// --- Test Helpers ---

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

function makeEntry(overrides: Partial<WidgetEntry> = {}): WidgetEntry {
  return {
    date: new Date(),
    usageData: makeUsageData(),
    configuration: { size: WidgetSize.Small },
    ...overrides,
  };
}

// ===================== Tests =====================

describe('ClaudeUsageWidgetView', () => {
  describe('widgetSize maps WidgetFamily to WidgetSize enum', () => {
    it('returns WidgetSize.Small for systemSmall family', () => {
      expect(widgetSize('systemSmall')).toBe(WidgetSize.Small);
    });

    it('returns WidgetSize.Medium for systemMedium family', () => {
      expect(widgetSize('systemMedium')).toBe(WidgetSize.Medium);
    });

    it('returns null for systemLarge family', () => {
      expect(widgetSize('systemLarge')).toBeNull();
    });

    it('returns null for systemExtraLarge family', () => {
      expect(widgetSize('systemExtraLarge')).toBeNull();
    });
  });

  describe('viewForSize returns SmallWidgetView when size is WidgetSize.Small', () => {
    it('routes to SmallWidgetView with correct entry data', () => {
      const entry = makeEntry({ configuration: { size: WidgetSize.Small } });
      const result = viewForSize(WidgetSize.Small, entry);

      expect(result.type).toBe('SmallWidgetView');
      expect(result.entry).toBe(entry);
      expect(result.entry.usageData).not.toBeNull();
    });

    it('passes through null usageData to SmallWidgetView', () => {
      const entry = makeEntry({ usageData: null });
      const result = viewForSize(WidgetSize.Small, entry);

      expect(result.type).toBe('SmallWidgetView');
      expect(result.entry.usageData).toBeNull();
    });
  });

  describe('viewForSize returns MediumWidgetView when size is WidgetSize.Medium', () => {
    it('routes to MediumWidgetView with correct entry data', () => {
      const entry = makeEntry({ configuration: { size: WidgetSize.Medium } });
      const result = viewForSize(WidgetSize.Medium, entry);

      expect(result.type).toBe('MediumWidgetView');
      expect(result.entry).toBe(entry);
      expect(result.entry.usageData).not.toBeNull();
    });

    it('passes through null usageData to MediumWidgetView', () => {
      const entry = makeEntry({ usageData: null, configuration: { size: WidgetSize.Medium } });
      const result = viewForSize(WidgetSize.Medium, entry);

      expect(result.type).toBe('MediumWidgetView');
      expect(result.entry.usageData).toBeNull();
    });
  });

  describe('viewForSize handles unknown widget size gracefully', () => {
    it('returns fallback view when size is null', () => {
      const entry = makeEntry();
      const result = viewForSize(null, entry);

      expect(result.type).toBe('FallbackView');
      expect(result.entry).toBe(entry);
    });

    it('fallback view still receives entry data', () => {
      const entry = makeEntry();
      const result = viewForSize(null, entry);

      expect(result.entry.date).toBeInstanceOf(Date);
      expect(result.entry.configuration).toBeDefined();
    });
  });

  describe('end-to-end routing from WidgetFamily to view', () => {
    it('routes systemSmall to SmallWidgetView', () => {
      const entry = makeEntry();
      const size = widgetSize('systemSmall');
      const result = viewForSize(size, entry);

      expect(result.type).toBe('SmallWidgetView');
    });

    it('routes systemMedium to MediumWidgetView', () => {
      const entry = makeEntry({ configuration: { size: WidgetSize.Medium } });
      const size = widgetSize('systemMedium');
      const result = viewForSize(size, entry);

      expect(result.type).toBe('MediumWidgetView');
    });

    it('routes unsupported systemLarge to FallbackView', () => {
      const entry = makeEntry();
      const size = widgetSize('systemLarge');
      const result = viewForSize(size, entry);

      expect(result.type).toBe('FallbackView');
    });
  });

  describe('WidgetEntry data passes through unchanged to child views', () => {
    it('preserves all entry fields when routing to small', () => {
      const usageData = makeUsageData({ tokensUsed: 999_999 });
      const entry = makeEntry({ usageData, configuration: { size: WidgetSize.Small } });
      const result = viewForSize(WidgetSize.Small, entry);

      expect(result.entry.usageData?.tokensUsed).toBe(999_999);
      expect(result.entry.date).toBe(entry.date);
      expect(result.entry.configuration.size).toBe(WidgetSize.Small);
    });

    it('preserves all entry fields when routing to medium', () => {
      const usageData = makeUsageData({ messagesUsed: 48 });
      const entry = makeEntry({ usageData, configuration: { size: WidgetSize.Medium } });
      const result = viewForSize(WidgetSize.Medium, entry);

      expect(result.entry.usageData?.messagesUsed).toBe(48);
      expect(result.entry.date).toBe(entry.date);
      expect(result.entry.configuration.size).toBe(WidgetSize.Medium);
    });
  });

  describe('WidgetSize enum values', () => {
    it('Small has correct string value', () => {
      expect(WidgetSize.Small).toBe('small');
    });

    it('Medium has correct string value', () => {
      expect(WidgetSize.Medium).toBe('medium');
    });
  });
});
