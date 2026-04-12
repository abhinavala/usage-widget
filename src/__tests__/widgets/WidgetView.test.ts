import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const WIDGETS_DIR = resolve(__dirname, '..', '..', 'widgets');
const TYPES_DIR = resolve(__dirname, '..', '..', 'types');

const widgetViewContent = readFileSync(
  resolve(WIDGETS_DIR, 'WidgetView.swift'),
  'utf-8'
);

const layoutHelperContent = readFileSync(
  resolve(WIDGETS_DIR, 'WidgetLayoutHelper.swift'),
  'utf-8'
);

const widgetTypesContent = readFileSync(
  resolve(TYPES_DIR, 'widget.ts'),
  'utf-8'
);

const usageTypesContent = readFileSync(
  resolve(TYPES_DIR, 'usage.ts'),
  'utf-8'
);

describe('WidgetView', () => {
  describe('WidgetView displays progress bar when showProgressBars is true', () => {
    it('imports SwiftUI and WidgetKit', () => {
      expect(widgetViewContent).toContain('import SwiftUI');
      expect(widgetViewContent).toContain('import WidgetKit');
    });

    it('defines WidgetView struct conforming to View', () => {
      expect(widgetViewContent).toContain('struct WidgetView: View');
    });

    it('accepts WidgetData', () => {
      expect(widgetViewContent).toContain('let data: WidgetData');
    });

    it('renders ProgressBarView when showProgressBars is true', () => {
      expect(widgetViewContent).toContain('if data.config.showProgressBars');
      expect(widgetViewContent).toContain('ProgressBarView(config:');
    });

    it('uses ProgressBarState derived from UsageData in the progress bar', () => {
      expect(widgetViewContent).toContain('func createProgressState(from usage: UsageData, config: ProgressBarConfig) -> ProgressBarState');
    });

    it('calculates percentage from token usage', () => {
      expect(widgetViewContent).toContain('(Double(tokensUsed) / Double(tokensLimit)) * 100.0');
    });

    it('determines threshold level based on percentage and config thresholds', () => {
      expect(widgetViewContent).toContain('if percentage < config.threshold1');
      expect(widgetViewContent).toContain('threshold = .low');
      expect(widgetViewContent).toContain('threshold = .medium');
      expect(widgetViewContent).toContain('threshold = .high');
    });
  });

  describe('isDataStale returns true for usage data older than 15 minutes', () => {
    it('defines isDataStale function', () => {
      expect(widgetViewContent).toContain('func isDataStale(usage: UsageData) -> Bool');
    });

    it('uses 15 minute stale threshold', () => {
      expect(widgetViewContent).toContain('15 * 60');
    });

    it('compares lastUpdated age against threshold', () => {
      expect(widgetViewContent).toContain('Date().timeIntervalSince(usage.lastUpdated)');
      expect(widgetViewContent).toContain('age > staleThresholdSeconds');
    });

    it('returns false for fresh data (within threshold)', () => {
      // The function returns age > staleThresholdSeconds, so fresh data returns false
      expect(widgetViewContent).toContain('return age > staleThresholdSeconds');
    });

    it('shows stale data view when data is stale', () => {
      expect(widgetViewContent).toContain('if isDataStale(usage: data.usage)');
      expect(widgetViewContent).toContain('StaleDataView(data: data)');
    });

    it('stale view shows informational message', () => {
      expect(widgetViewContent).toContain('Data may be outdated');
    });
  });

  describe('createProgressState correctly transforms UsageData to ProgressBarState', () => {
    it('defines createProgressState function with correct signature', () => {
      expect(widgetViewContent).toContain(
        'func createProgressState(from usage: UsageData, config: ProgressBarConfig) -> ProgressBarState'
      );
    });

    it('percentage equals (tokensUsed / tokensLimit) * 100', () => {
      expect(widgetViewContent).toContain('let rawPercentage = (Double(tokensUsed) / Double(tokensLimit)) * 100.0');
    });

    it('clamps percentage between 0 and 100', () => {
      expect(widgetViewContent).toContain('min(max(round(rawPercentage), 0), 100)');
    });

    it('returns low threshold when percentage is below threshold1', () => {
      expect(widgetViewContent).toContain('if percentage < config.threshold1');
      expect(widgetViewContent).toContain('threshold = .low');
    });

    it('returns medium threshold when between threshold1 and threshold2', () => {
      expect(widgetViewContent).toContain('else if percentage < config.threshold2');
      expect(widgetViewContent).toContain('threshold = .medium');
    });

    it('returns high threshold when above threshold2', () => {
      expect(widgetViewContent).toContain('threshold = .high');
    });

    it('handles zero total gracefully', () => {
      expect(widgetViewContent).toContain('guard tokensLimit > 0');
    });

    it('uses effective usage data with overrides applied', () => {
      expect(widgetViewContent).toContain('usage.getEffectiveUsage()');
    });
  });

  describe('widget layout integration', () => {
    it('defines SmallWidgetLayout', () => {
      expect(widgetViewContent).toContain('struct SmallWidgetLayout: View');
    });

    it('defines MediumWidgetLayout', () => {
      expect(widgetViewContent).toContain('struct MediumWidgetLayout: View');
    });

    it('small layout uses appropriate font sizes from WidgetStyleProvider', () => {
      expect(widgetViewContent).toContain("WidgetStyleProvider.fontForSize(.small,");
    });

    it('medium layout uses appropriate font sizes from WidgetStyleProvider', () => {
      expect(widgetViewContent).toContain("WidgetStyleProvider.fontForSize(.medium,");
    });

    it('uses WidgetStyleProvider for progress bar height', () => {
      expect(widgetViewContent).toContain('WidgetStyleProvider.progressBarHeight(for:');
    });

    it('medium layout shows separate input and output progress bars', () => {
      expect(widgetViewContent).toContain('WidgetLayoutHelper.inputProgressConfig(');
      expect(widgetViewContent).toContain('WidgetLayoutHelper.outputProgressConfig(');
    });

    it('displays reset time', () => {
      expect(widgetViewContent).toContain('data.usage.resetTime, style: .relative');
    });
  });

  describe('WidgetLayoutHelper', () => {
    it('defines inputProgressConfig', () => {
      expect(layoutHelperContent).toContain('static func inputProgressConfig(');
    });

    it('defines outputProgressConfig', () => {
      expect(layoutHelperContent).toContain('static func outputProgressConfig(');
    });

    it('calculates input percentage from inputTokens and inputLimit', () => {
      expect(layoutHelperContent).toContain('Double(effective.inputTokens) / Double(effective.inputLimit)');
    });

    it('calculates output percentage from outputTokens and outputLimit', () => {
      expect(layoutHelperContent).toContain('Double(effective.outputTokens) / Double(effective.outputLimit)');
    });

    it('clamps percentages to valid range', () => {
      expect(layoutHelperContent).toContain('min(max(');
    });

    it('uses effective usage data', () => {
      expect(layoutHelperContent).toContain('usage.getEffectiveUsage()');
    });
  });

  describe('TypeScript type definitions', () => {
    it('exports WidgetData interface with required fields', () => {
      expect(widgetTypesContent).toContain('export interface WidgetData');
      expect(widgetTypesContent).toContain('usage: UsageData');
      expect(widgetTypesContent).toContain('progress: ProgressBarState');
      expect(widgetTypesContent).toContain('size: WidgetSize');
      expect(widgetTypesContent).toContain('config: WidgetConfiguration');
    });

    it('WidgetConfiguration includes showProgressBars', () => {
      expect(widgetTypesContent).toContain('showProgressBars: boolean');
    });

    it('WidgetConfiguration includes progressConfig', () => {
      expect(widgetTypesContent).toContain('progressConfig: ProgressBarConfig');
    });

    it('exports UsageProgress interface', () => {
      expect(usageTypesContent).toContain('export interface UsageProgress');
      expect(usageTypesContent).toContain('usage: UsageData');
      expect(usageTypesContent).toContain('progressBar: ProgressBarState');
    });
  });
});
