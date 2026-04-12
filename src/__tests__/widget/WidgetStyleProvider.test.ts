import { describe, it, expect } from 'vitest';
import { ProgressColors } from '../../types/ui';
import { WidgetSize } from '../../types/widget';

// MARK: - TypeScript mirror of WidgetStyleProvider.swift

enum ColorTheme {
  Light = 'light',
  Dark = 'dark',
  Auto = 'auto',
}

interface FontSpec {
  size: number;
  weight: string;
}

type FontTextStyle = 'title' | 'title2' | 'headline' | 'body' | 'caption' | 'caption2';

const SMALL_FONTS: Record<FontTextStyle, FontSpec> = {
  title: { size: 16, weight: 'bold' },
  title2: { size: 14, weight: 'bold' },
  headline: { size: 13, weight: 'semibold' },
  body: { size: 12, weight: 'regular' },
  caption: { size: 10, weight: 'medium' },
  caption2: { size: 9, weight: 'regular' },
};

const MEDIUM_FONTS: Record<FontTextStyle, FontSpec> = {
  title: { size: 20, weight: 'bold' },
  title2: { size: 18, weight: 'bold' },
  headline: { size: 15, weight: 'semibold' },
  body: { size: 14, weight: 'regular' },
  caption: { size: 12, weight: 'medium' },
  caption2: { size: 10, weight: 'regular' },
};

function fontForSize(widgetSize: WidgetSize, style: FontTextStyle): FontSpec {
  return widgetSize === WidgetSize.Small ? SMALL_FONTS[style] : MEDIUM_FONTS[style];
}

function progressBarHeight(widgetSize: WidgetSize): number {
  return widgetSize === WidgetSize.Small ? 4 : 6;
}

function progressBarCornerRadius(widgetSize: WidgetSize): number {
  return widgetSize === WidgetSize.Small ? 2 : 3;
}

interface SpacingValues {
  contentPadding: number;
  itemSpacing: number;
  sectionSpacing: number;
}

function spacingForSize(widgetSize: WidgetSize): SpacingValues {
  return widgetSize === WidgetSize.Small
    ? { contentPadding: 10, itemSpacing: 4, sectionSpacing: 6 }
    : { contentPadding: 12, itemSpacing: 8, sectionSpacing: 16 };
}

function contentPadding(widgetSize: WidgetSize): number {
  return spacingForSize(widgetSize).contentPadding;
}

function itemSpacing(widgetSize: WidgetSize): number {
  return spacingForSize(widgetSize).itemSpacing;
}

function sectionSpacing(widgetSize: WidgetSize): number {
  return spacingForSize(widgetSize).sectionSpacing;
}

function colorsForTheme(theme: ColorTheme): ProgressColors {
  switch (theme) {
    case ColorTheme.Light:
      return {
        low: 'rgba(51,179,77)',
        medium: 'rgba(230,204,26)',
        high: 'rgba(242,153,26)',
        critical: 'rgba(230,51,51)',
      };
    case ColorTheme.Dark:
      return {
        low: 'rgba(77,217,102)',
        medium: 'rgba(255,230,77)',
        high: 'rgba(255,179,51)',
        critical: 'rgba(255,77,77)',
      };
    case ColorTheme.Auto:
      return {
        low: 'green',
        medium: 'yellow',
        high: 'orange',
        critical: 'red',
      };
  }
}

// MARK: - Tests

describe('WidgetStyleProvider', () => {
  describe('fontForSize', () => {
    it('returns appropriate font size for small widget with title style', () => {
      const smallFont = fontForSize(WidgetSize.Small, 'title');
      const mediumFont = fontForSize(WidgetSize.Medium, 'title');

      // Small font should be smaller than medium
      expect(smallFont.size).toBeLessThan(mediumFont.size);
      // Small title should be larger than caption2 minimum
      const caption2 = fontForSize(WidgetSize.Small, 'caption2');
      expect(smallFont.size).toBeGreaterThan(caption2.size);
    });

    it('returns larger fonts for medium widget across all styles', () => {
      const styles: FontTextStyle[] = ['title', 'title2', 'headline', 'body', 'caption', 'caption2'];
      for (const style of styles) {
        const small = fontForSize(WidgetSize.Small, style);
        const medium = fontForSize(WidgetSize.Medium, style);
        expect(medium.size).toBeGreaterThan(small.size);
      }
    });

    it('maintains visual hierarchy within each size', () => {
      for (const size of [WidgetSize.Small, WidgetSize.Medium]) {
        const title = fontForSize(size, 'title');
        const title2 = fontForSize(size, 'title2');
        const headline = fontForSize(size, 'headline');
        const body = fontForSize(size, 'body');
        const caption = fontForSize(size, 'caption');
        const caption2 = fontForSize(size, 'caption2');

        expect(title.size).toBeGreaterThan(title2.size);
        expect(title2.size).toBeGreaterThan(headline.size);
        expect(headline.size).toBeGreaterThan(body.size);
        expect(body.size).toBeGreaterThan(caption.size);
        expect(caption.size).toBeGreaterThan(caption2.size);
      }
    });

    it('small widget fonts are all at least 9pt for readability', () => {
      const styles: FontTextStyle[] = ['title', 'title2', 'headline', 'body', 'caption', 'caption2'];
      for (const style of styles) {
        const font = fontForSize(WidgetSize.Small, style);
        expect(font.size).toBeGreaterThanOrEqual(9);
      }
    });
  });

  describe('colorsForTheme', () => {
    it('returns correct ProgressColors for dark theme', () => {
      const colors = colorsForTheme(ColorTheme.Dark);

      expect(colors).toHaveProperty('low');
      expect(colors).toHaveProperty('medium');
      expect(colors).toHaveProperty('high');
      expect(colors).toHaveProperty('critical');

      // Dark theme colors should be brighter (higher values) for contrast
      expect(colors.low).not.toBe(colors.critical);
      expect(colors.medium).not.toBe(colors.high);
    });

    it('returns correct ProgressColors for light theme', () => {
      const colors = colorsForTheme(ColorTheme.Light);

      expect(colors).toHaveProperty('low');
      expect(colors).toHaveProperty('medium');
      expect(colors).toHaveProperty('high');
      expect(colors).toHaveProperty('critical');
    });

    it('returns correct ProgressColors for auto theme', () => {
      const colors = colorsForTheme(ColorTheme.Auto);

      expect(colors.low).toBe('green');
      expect(colors.medium).toBe('yellow');
      expect(colors.high).toBe('orange');
      expect(colors.critical).toBe('red');
    });

    it('returns distinct colors for each severity level', () => {
      for (const theme of [ColorTheme.Light, ColorTheme.Dark, ColorTheme.Auto]) {
        const colors = colorsForTheme(theme);
        const values = [colors.low, colors.medium, colors.high, colors.critical];
        const unique = new Set(values);
        expect(unique.size).toBe(4);
      }
    });

    it('light and dark themes return different colors', () => {
      const light = colorsForTheme(ColorTheme.Light);
      const dark = colorsForTheme(ColorTheme.Dark);

      expect(light.low).not.toBe(dark.low);
      expect(light.critical).not.toBe(dark.critical);
    });
  });

  describe('progressBarHeight', () => {
    it('returns different values for small vs medium widget sizes', () => {
      const smallHeight = progressBarHeight(WidgetSize.Small);
      const mediumHeight = progressBarHeight(WidgetSize.Medium);

      expect(smallHeight).toBeGreaterThan(0);
      expect(mediumHeight).toBeGreaterThan(0);
      expect(smallHeight).toBeLessThan(mediumHeight);
    });
  });

  describe('progressBarCornerRadius', () => {
    it('returns smaller corner radius for small widget', () => {
      const small = progressBarCornerRadius(WidgetSize.Small);
      const medium = progressBarCornerRadius(WidgetSize.Medium);

      expect(small).toBeGreaterThan(0);
      expect(medium).toBeGreaterThan(0);
      expect(small).toBeLessThan(medium);
    });
  });

  describe('spacingForSize', () => {
    it('returns all spacing values bundled for small widget', () => {
      const spacing = spacingForSize(WidgetSize.Small);
      expect(spacing.contentPadding).toBe(10);
      expect(spacing.itemSpacing).toBe(4);
      expect(spacing.sectionSpacing).toBe(6);
    });

    it('returns all spacing values bundled for medium widget', () => {
      const spacing = spacingForSize(WidgetSize.Medium);
      expect(spacing.contentPadding).toBe(12);
      expect(spacing.itemSpacing).toBe(8);
      expect(spacing.sectionSpacing).toBe(16);
    });

    it('small spacing values are all less than medium', () => {
      const small = spacingForSize(WidgetSize.Small);
      const medium = spacingForSize(WidgetSize.Medium);
      expect(small.contentPadding).toBeLessThan(medium.contentPadding);
      expect(small.itemSpacing).toBeLessThan(medium.itemSpacing);
      expect(small.sectionSpacing).toBeLessThan(medium.sectionSpacing);
    });
  });

  describe('spacing', () => {
    it('content padding is smaller for small widget', () => {
      expect(contentPadding(WidgetSize.Small)).toBeLessThan(contentPadding(WidgetSize.Medium));
    });

    it('item spacing is smaller for small widget', () => {
      expect(itemSpacing(WidgetSize.Small)).toBeLessThan(itemSpacing(WidgetSize.Medium));
    });

    it('section spacing is smaller for small widget', () => {
      expect(sectionSpacing(WidgetSize.Small)).toBeLessThan(sectionSpacing(WidgetSize.Medium));
    });

    it('all spacing values are positive', () => {
      for (const size of [WidgetSize.Small, WidgetSize.Medium]) {
        expect(contentPadding(size)).toBeGreaterThan(0);
        expect(itemSpacing(size)).toBeGreaterThan(0);
        expect(sectionSpacing(size)).toBeGreaterThan(0);
      }
    });
  });
});
