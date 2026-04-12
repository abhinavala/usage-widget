import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT_DIR = resolve(__dirname, '..', '..', '..');
const TYPES_DIR = resolve(__dirname, '..', '..', 'types');

const widgetViewContent = readFileSync(
  resolve(ROOT_DIR, 'ClaudeUsageWidgetView.swift'),
  'utf-8'
);

describe('ClaudeUsageWidgetView', () => {
  describe('view routing structure', () => {
    it('imports SwiftUI and WidgetKit', () => {
      expect(widgetViewContent).toContain('import SwiftUI');
      expect(widgetViewContent).toContain('import WidgetKit');
    });

    it('defines ClaudeUsageWidgetView struct conforming to View', () => {
      expect(widgetViewContent).toContain('struct ClaudeUsageWidgetView: View');
    });

    it('accepts a WidgetEntry', () => {
      expect(widgetViewContent).toContain('let entry: WidgetEntry');
    });

    it('reads widgetFamily from environment', () => {
      expect(widgetViewContent).toContain('@Environment(\\.widgetFamily) var widgetFamily');
    });

    it('has a viewForSize routing method', () => {
      expect(widgetViewContent).toContain('func viewForSize(');
    });

    it('calls viewForSize from body', () => {
      expect(widgetViewContent).toContain('viewForSize(widgetSize(for: widgetFamily))');
    });
  });

  describe('viewForSize returns SmallWidgetView when size is WidgetSize.Small', () => {
    it('routes to SmallWidgetView for small size', () => {
      expect(widgetViewContent).toContain('case .small:');
      expect(widgetViewContent).toContain('SmallWidgetView(entry: entry)');
    });

    it('passes entry data through to SmallWidgetView', () => {
      expect(widgetViewContent).toContain('SmallWidgetView(entry: entry)');
    });
  });

  describe('viewForSize returns MediumWidgetView when size is WidgetSize.Medium', () => {
    it('routes to MediumWidgetView for medium size', () => {
      expect(widgetViewContent).toContain('case .medium:');
      expect(widgetViewContent).toContain('MediumWidgetView(entry: entry)');
    });

    it('passes entry data through to MediumWidgetView', () => {
      expect(widgetViewContent).toContain('MediumWidgetView(entry: entry)');
    });
  });

  describe('widgetSize returns correct WidgetSize enum for systemMedium family', () => {
    it('defines widgetSize function that maps WidgetFamily to WidgetSize', () => {
      expect(widgetViewContent).toContain('func widgetSize(for family: WidgetFamily) -> WidgetSize');
    });

    it('maps systemSmall to .small', () => {
      expect(widgetViewContent).toContain('case .systemSmall:');
      expect(widgetViewContent).toContain('return .small');
    });

    it('maps systemMedium to .medium', () => {
      expect(widgetViewContent).toContain('case .systemMedium:');
      expect(widgetViewContent).toContain('return .medium');
    });
  });

  describe('viewForSize handles unknown widget size gracefully', () => {
    it('defines an UnsupportedWidgetView for fallback', () => {
      expect(widgetViewContent).toContain('struct UnsupportedWidgetView: View');
    });

    it('shows an error message in the fallback view', () => {
      expect(widgetViewContent).toContain('Unsupported widget size');
    });

    it('includes accessibility label on fallback view', () => {
      expect(widgetViewContent).toContain('.accessibilityLabel("Unsupported widget size")');
    });

    it('WidgetSize enum handles unknown families with a default case', () => {
      expect(widgetViewContent).toContain('default:');
    });
  });

  describe('WidgetEntry data model', () => {
    it('defines WidgetEntry conforming to TimelineEntry', () => {
      expect(widgetViewContent).toContain('struct WidgetEntry: TimelineEntry');
    });

    it('has a date field', () => {
      expect(widgetViewContent).toContain('let date: Date');
    });

    it('has an optional usageData field', () => {
      expect(widgetViewContent).toContain('let usageData: UsageData?');
    });

    it('has a configuration field', () => {
      expect(widgetViewContent).toContain('let configuration: WidgetConfiguration');
    });
  });

  describe('WidgetSize enum', () => {
    it('defines WidgetSize enum', () => {
      expect(widgetViewContent).toContain('enum WidgetSize');
    });

    it('has small case', () => {
      expect(widgetViewContent).toContain('case small');
    });

    it('has medium case', () => {
      expect(widgetViewContent).toContain('case medium');
    });
  });

  describe('TypeScript type definitions', () => {
    const widgetTypesContent = readFileSync(
      resolve(TYPES_DIR, 'widget.ts'),
      'utf-8'
    );
    const uiTypesContent = readFileSync(
      resolve(TYPES_DIR, 'ui.ts'),
      'utf-8'
    );

    it('exports WidgetSize enum', () => {
      expect(widgetTypesContent).toContain('export enum WidgetSize');
    });

    it('WidgetSize has small and medium values', () => {
      expect(widgetTypesContent).toContain("= 'small'");
      expect(widgetTypesContent).toContain("= 'medium'");
    });

    it('exports WidgetConfiguration interface', () => {
      expect(widgetTypesContent).toContain('export interface WidgetConfiguration');
    });

    it('WidgetConfiguration has showTokens and showRequests', () => {
      expect(widgetTypesContent).toContain('showTokens: boolean');
      expect(widgetTypesContent).toContain('showRequests: boolean');
    });

    it('exports ProgressColors interface', () => {
      expect(uiTypesContent).toContain('export interface ProgressColors');
    });

    it('exports ProgressBarConfig interface', () => {
      expect(uiTypesContent).toContain('export interface ProgressBarConfig');
    });
  });
});
