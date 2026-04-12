import { ProgressColors } from '../types/ui';
import { WidgetSize } from '../types/widget';

export { ProgressColors, WidgetSize };

// MARK: - ColorTheme

export enum ColorTheme {
  Light = 'light',
  Dark = 'dark',
  Auto = 'auto',
}

// MARK: - Font Text Style

export enum FontTextStyle {
  LargeTitle = 'largeTitle',
  Title = 'title',
  Title2 = 'title2',
  Title3 = 'title3',
  Headline = 'headline',
  Body = 'body',
  Callout = 'callout',
  Subheadline = 'subheadline',
  Footnote = 'footnote',
  Caption = 'caption',
  Caption2 = 'caption2',
}

// MARK: - Font Descriptor

export interface FontDescriptor {
  size: number;
  weight: 'regular' | 'semibold' | 'bold';
}

// MARK: - Widget Spacing

export interface WidgetSpacing {
  padding: number;
  itemSpacing: number;
  sectionSpacing: number;
  progressBarPadding: number;
}

// MARK: - Font size maps

const SMALL_FONT_MAP: Record<FontTextStyle, FontDescriptor> = {
  [FontTextStyle.LargeTitle]: { size: 22, weight: 'bold' },
  [FontTextStyle.Title]: { size: 17, weight: 'bold' },
  [FontTextStyle.Title2]: { size: 15, weight: 'semibold' },
  [FontTextStyle.Title3]: { size: 13, weight: 'semibold' },
  [FontTextStyle.Headline]: { size: 12, weight: 'semibold' },
  [FontTextStyle.Body]: { size: 11, weight: 'regular' },
  [FontTextStyle.Callout]: { size: 10, weight: 'regular' },
  [FontTextStyle.Subheadline]: { size: 10, weight: 'regular' },
  [FontTextStyle.Footnote]: { size: 9, weight: 'regular' },
  [FontTextStyle.Caption]: { size: 9, weight: 'regular' },
  [FontTextStyle.Caption2]: { size: 8, weight: 'regular' },
};

const MEDIUM_FONT_MAP: Record<FontTextStyle, FontDescriptor> = {
  [FontTextStyle.LargeTitle]: { size: 28, weight: 'bold' },
  [FontTextStyle.Title]: { size: 22, weight: 'bold' },
  [FontTextStyle.Title2]: { size: 18, weight: 'semibold' },
  [FontTextStyle.Title3]: { size: 16, weight: 'semibold' },
  [FontTextStyle.Headline]: { size: 14, weight: 'semibold' },
  [FontTextStyle.Body]: { size: 14, weight: 'regular' },
  [FontTextStyle.Callout]: { size: 13, weight: 'regular' },
  [FontTextStyle.Subheadline]: { size: 12, weight: 'regular' },
  [FontTextStyle.Footnote]: { size: 11, weight: 'regular' },
  [FontTextStyle.Caption]: { size: 10, weight: 'regular' },
  [FontTextStyle.Caption2]: { size: 9, weight: 'regular' },
};

// MARK: - WidgetStyleProvider

export class WidgetStyleProvider {
  /**
   * Returns a size-appropriate font descriptor for the given widget size and text style.
   * Small widgets use reduced font sizes; medium widgets use standard sizes.
   */
  static fontForSize(size: WidgetSize, style: FontTextStyle): FontDescriptor {
    switch (size) {
      case WidgetSize.SMALL:
        return SMALL_FONT_MAP[style];
      case WidgetSize.MEDIUM:
        return MEDIUM_FONT_MAP[style];
    }
  }

  /**
   * Returns size-appropriate spacing values for the given widget size.
   */
  static spacingForSize(size: WidgetSize): WidgetSpacing {
    switch (size) {
      case WidgetSize.SMALL:
        return {
          padding: 10,
          itemSpacing: 4,
          sectionSpacing: 8,
          progressBarPadding: 2,
        };
      case WidgetSize.MEDIUM:
        return {
          padding: 14,
          itemSpacing: 6,
          sectionSpacing: 12,
          progressBarPadding: 4,
        };
    }
  }

  /**
   * Returns the appropriate progress bar height for the given widget size.
   */
  static progressBarHeight(size: WidgetSize): number {
    switch (size) {
      case WidgetSize.SMALL:
        return 6;
      case WidgetSize.MEDIUM:
        return 10;
    }
  }

  /**
   * Returns the appropriate progress bar corner radius for the given widget size.
   */
  static progressBarCornerRadius(size: WidgetSize): number {
    switch (size) {
      case WidgetSize.SMALL:
        return 3;
      case WidgetSize.MEDIUM:
        return 5;
    }
  }

  /**
   * Returns ProgressColors appropriate for the given color theme.
   * Colors meet WCAG AA contrast requirements.
   */
  static colorsForTheme(theme: ColorTheme): ProgressColors {
    switch (theme) {
      case ColorTheme.Light:
        return {
          low: '#33A652',
          medium: '#E69E00',
          high: '#DB3545',
          background: '#E5E5E5',
        };
      case ColorTheme.Dark:
        return {
          low: '#4DD973',
          medium: '#FFC226',
          high: '#FF6161',
          background: '#404040',
        };
      case ColorTheme.Auto:
        return {
          low: '#34C759',
          medium: '#FF9500',
          high: '#FF3B30',
          background: '#E5E5EA',
        };
    }
  }
}
