import { describe, it, expect } from 'vitest';
import {
  WidgetSize,
  supportedFamilies,
  generateTimelineEntries,
} from '../../types/widget';
import type { WidgetEntry } from '../../types/widget';
import type { UsageData } from '../../types/usage';

describe('ClaudeUsageWidget', () => {
  describe('supportedFamilies', () => {
    it('returns both systemSmall and systemMedium', () => {
      const families = supportedFamilies();

      expect(families).toHaveLength(2);
      expect(families).toContain(WidgetSize.Small);
      expect(families).toContain(WidgetSize.Medium);
    });

    it('returns only small and medium sizes', () => {
      const families = supportedFamilies();

      // Ensure no unexpected sizes are included
      for (const family of families) {
        expect([WidgetSize.Small, WidgetSize.Medium]).toContain(family);
      }
    });
  });

  describe('timeline provider - small widget', () => {
    it('generates valid entries for small widget family', () => {
      const usageData: UsageData = {
        tokensUsed: 500_000,
        tokensLimit: 1_000_000,
        messagesUsed: 25,
        messagesLimit: 50,
        resetTime: new Date('2026-04-11T15:00:00Z'),
        lastUpdated: new Date(),
      };

      const entries = generateTimelineEntries(WidgetSize.Small, usageData, {
        maxEntries: 5,
      });

      expect(entries).toHaveLength(5);

      for (const entry of entries) {
        expect(entry.date).toBeInstanceOf(Date);
        expect(entry.usageData).not.toBeNull();
        expect(entry.usageData).toEqual(usageData);
        expect(entry.configuration.size).toBe(WidgetSize.Small);
      }
    });

    it('generates entries with increasing dates', () => {
      const entries = generateTimelineEntries(WidgetSize.Small, null, {
        maxEntries: 3,
        refreshInterval: 60_000,
      });

      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].date.getTime()).toBeGreaterThan(
          entries[i - 1].date.getTime()
        );
      }
    });

    it('handles null usageData for small widget', () => {
      const entries = generateTimelineEntries(WidgetSize.Small, null, {
        maxEntries: 1,
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].usageData).toBeNull();
      expect(entries[0].configuration.size).toBe(WidgetSize.Small);
    });
  });

  describe('timeline provider - medium widget', () => {
    it('generates valid entries for medium widget family', () => {
      const usageData: UsageData = {
        tokensUsed: 750_000,
        tokensLimit: 1_000_000,
        messagesUsed: 40,
        messagesLimit: 50,
        resetTime: new Date('2026-04-11T15:00:00Z'),
        lastUpdated: new Date(),
      };

      const entries = generateTimelineEntries(WidgetSize.Medium, usageData, {
        maxEntries: 5,
      });

      expect(entries).toHaveLength(5);

      for (const entry of entries) {
        expect(entry.date).toBeInstanceOf(Date);
        expect(entry.usageData).not.toBeNull();
        expect(entry.usageData).toEqual(usageData);
        expect(entry.configuration.size).toBe(WidgetSize.Medium);
      }
    });

    it('generates entries with proper configuration for medium size', () => {
      const entries = generateTimelineEntries(WidgetSize.Medium, null, {
        maxEntries: 3,
      });

      for (const entry of entries) {
        expect(entry.configuration).toEqual({ size: WidgetSize.Medium });
      }
    });

    it('handles null usageData for medium widget', () => {
      const entries = generateTimelineEntries(WidgetSize.Medium, null, {
        maxEntries: 1,
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].usageData).toBeNull();
      expect(entries[0].configuration.size).toBe(WidgetSize.Medium);
    });
  });

  describe('timeline defaults', () => {
    it('generates 60 entries by default', () => {
      const entries = generateTimelineEntries(WidgetSize.Small, null);

      expect(entries).toHaveLength(60);
    });

    it('uses 1-minute intervals by default', () => {
      const entries = generateTimelineEntries(WidgetSize.Small, null, {
        maxEntries: 3,
      });

      const interval =
        entries[1].date.getTime() - entries[0].date.getTime();
      expect(interval).toBe(60_000);
    });
  });
});
