import { describe, it, expect } from 'vitest';
import {
  WidgetStyleProvider,
  WidgetSize,
  ColorTheme,
  FontTextStyle,
} from '../../widget/WidgetStyleProvider';

describe('WidgetStyleProvider', () => {
  describe('fontForSize', () => {
    it('returns appropriate font size for small widget with title style', () => {
      const smallFont = WidgetStyleProvider.fontForSize(WidgetSize.SMALL, FontTextStyle.Title);
      const mediumFont = WidgetStyleProvider.fontForSize(WidgetSize.MEDIUM, FontTextStyle.Title);
      const caption2Font = WidgetStyleProvider.fontForSize(WidgetSize.SMALL, FontTextStyle.Caption2);

      // Small title should be smaller than medium title
      expect(smallFont.size).toBeLessThan(mediumFont.size);
      // Small title should be larger than caption2 minimum
      expect(smallFont.size).toBeGreaterThan(caption2Font.size);
      expect(smallFont.weight).toBe('bold');
    });

    it('returns smaller fonts for small widget across all styles', () => {
      const styles = Object.values(FontTextStyle);

      for (const style of styles) {
        const smallFont = WidgetStyleProvider.fontForSize(WidgetSize.SMALL, style);
        const mediumFont = WidgetStyleProvider.fontForSize(WidgetSize.MEDIUM, style);
        expect(smallFont.size).toBeLessThanOrEqual(mediumFont.size);
      }
    });

    it('returns valid font descriptors for all styles and sizes', () => {
      const sizes = [WidgetSize.SMALL, WidgetSize.MEDIUM];
      const styles = Object.values(FontTextStyle);

      for (const size of sizes) {
        for (const style of styles) {
          const font = WidgetStyleProvider.fontForSize(size, style);
          expect(font.size).toBeGreaterThan(0);
          expect(['regular', 'semibold', 'bold']).toContain(font.weight);
        }
      }
    });

    it('maintains visual hierarchy within each size', () => {
      const sizes = [WidgetSize.SMALL, WidgetSize.MEDIUM];

      for (const size of sizes) {
        const largeTitle = WidgetStyleProvider.fontForSize(size, FontTextStyle.LargeTitle);
        const title = WidgetStyleProvider.fontForSize(size, FontTextStyle.Title);
        const body = WidgetStyleProvider.fontForSize(size, FontTextStyle.Body);
        const caption2 = WidgetStyleProvider.fontForSize(size, FontTextStyle.Caption2);

        expect(largeTitle.size).toBeGreaterThan(title.size);
        expect(title.size).toBeGreaterThan(body.size);
        expect(body.size).toBeGreaterThan(caption2.size);
      }
    });
  });

  describe('spacingForSize', () => {
    it('returns smaller spacing for small widgets', () => {
      const smallSpacing = WidgetStyleProvider.spacingForSize(WidgetSize.SMALL);
      const mediumSpacing = WidgetStyleProvider.spacingForSize(WidgetSize.MEDIUM);

      expect(smallSpacing.padding).toBeLessThan(mediumSpacing.padding);
      expect(smallSpacing.itemSpacing).toBeLessThan(mediumSpacing.itemSpacing);
      expect(smallSpacing.sectionSpacing).toBeLessThan(mediumSpacing.sectionSpacing);
      expect(smallSpacing.progressBarPadding).toBeLessThan(mediumSpacing.progressBarPadding);
    });

    it('returns positive spacing values for all sizes', () => {
      const sizes = [WidgetSize.SMALL, WidgetSize.MEDIUM];

      for (const size of sizes) {
        const spacing = WidgetStyleProvider.spacingForSize(size);
        expect(spacing.padding).toBeGreaterThan(0);
        expect(spacing.itemSpacing).toBeGreaterThan(0);
        expect(spacing.sectionSpacing).toBeGreaterThan(0);
        expect(spacing.progressBarPadding).toBeGreaterThan(0);
      }
    });
  });

  describe('colorsForTheme', () => {
    it('returns correct ProgressColors for dark theme', () => {
      const colors = WidgetStyleProvider.colorsForTheme(ColorTheme.Dark);

      expect(colors.low).toBeDefined();
      expect(colors.medium).toBeDefined();
      expect(colors.high).toBeDefined();
      expect(colors.background).toBeDefined();

      // Dark theme colors should be brighter (higher values) for visibility
      // Verify they are valid hex color strings
      expect(colors.low).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.medium).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.high).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.background).toMatch(/^#[0-9A-Fa-f]{6}$/);

      // Dark background should be darker than light background
      const darkBg = colors.background;
      const lightBg = WidgetStyleProvider.colorsForTheme(ColorTheme.Light).background;
      expect(parseInt(darkBg.slice(1, 3), 16)).toBeLessThan(parseInt(lightBg.slice(1, 3), 16));
    });

    it('returns valid colors for all themes', () => {
      const themes = [ColorTheme.Light, ColorTheme.Dark, ColorTheme.Auto];

      for (const theme of themes) {
        const colors = WidgetStyleProvider.colorsForTheme(theme);
        expect(colors.low).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(colors.medium).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(colors.high).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(colors.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('returns distinct colors for low, medium, and high states', () => {
      const themes = [ColorTheme.Light, ColorTheme.Dark, ColorTheme.Auto];

      for (const theme of themes) {
        const colors = WidgetStyleProvider.colorsForTheme(theme);
        expect(colors.low).not.toBe(colors.medium);
        expect(colors.medium).not.toBe(colors.high);
        expect(colors.low).not.toBe(colors.high);
      }
    });
  });

  describe('progressBarHeight', () => {
    it('returns different values for small vs medium widget sizes', () => {
      const smallHeight = WidgetStyleProvider.progressBarHeight(WidgetSize.SMALL);
      const mediumHeight = WidgetStyleProvider.progressBarHeight(WidgetSize.MEDIUM);

      expect(smallHeight).toBeLessThan(mediumHeight);
      expect(smallHeight).toBeGreaterThan(0);
      expect(mediumHeight).toBeGreaterThan(0);
    });
  });

  describe('progressBarCornerRadius', () => {
    it('returns smaller corner radius for small widgets', () => {
      const smallRadius = WidgetStyleProvider.progressBarCornerRadius(WidgetSize.SMALL);
      const mediumRadius = WidgetStyleProvider.progressBarCornerRadius(WidgetSize.MEDIUM);

      expect(smallRadius).toBeLessThan(mediumRadius);
      expect(smallRadius).toBeGreaterThan(0);
      expect(mediumRadius).toBeGreaterThan(0);
    });

    it('corner radius is proportional to height', () => {
      const smallRadius = WidgetStyleProvider.progressBarCornerRadius(WidgetSize.SMALL);
      const smallHeight = WidgetStyleProvider.progressBarHeight(WidgetSize.SMALL);
      const mediumRadius = WidgetStyleProvider.progressBarCornerRadius(WidgetSize.MEDIUM);
      const mediumHeight = WidgetStyleProvider.progressBarHeight(WidgetSize.MEDIUM);

      // Corner radius should be roughly half the height
      expect(smallRadius).toBe(smallHeight / 2);
      expect(mediumRadius).toBe(mediumHeight / 2);
    });
  });
});
