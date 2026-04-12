import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const IOS_VIEWS_DIR = resolve(__dirname, '..', '..', 'ios', 'views');
const IOS_SERVICES_DIR = resolve(__dirname, '..', '..', 'ios', 'services');
const IOS_COMPONENTS_DIR = resolve(__dirname, '..', '..', 'ios', 'components');
const TYPES_DIR = resolve(__dirname, '..', '..', 'types');

const progressConfigViewContent = readFileSync(
  resolve(IOS_VIEWS_DIR, 'ProgressConfigView.swift'),
  'utf-8'
);

const configServiceContent = readFileSync(
  resolve(IOS_SERVICES_DIR, 'ConfigurationService.swift'),
  'utf-8'
);

const colorPickerRowContent = readFileSync(
  resolve(IOS_COMPONENTS_DIR, 'ColorPickerRow.swift'),
  'utf-8'
);

const widgetTypesContent = readFileSync(
  resolve(TYPES_DIR, 'widget.ts'),
  'utf-8'
);

const progressTypesContent = readFileSync(
  resolve(TYPES_DIR, 'progress.ts'),
  'utf-8'
);

const errorsTypesContent = readFileSync(
  resolve(TYPES_DIR, 'errors.ts'),
  'utf-8'
);

describe('ProgressConfigView', () => {
  describe('saveProgressConfig successfully stores valid configuration to iCloud', () => {
    it('defines ConfigurationService class', () => {
      expect(configServiceContent).toContain('class ConfigurationService');
    });

    it('defines saveProgressConfig function', () => {
      expect(configServiceContent).toContain('func saveProgressConfig(config: ProgressBarConfig)');
    });

    it('saves thresholds to NSUbiquitousKeyValueStore', () => {
      expect(configServiceContent).toContain('NSUbiquitousKeyValueStore');
      expect(configServiceContent).toContain('store.set(config.threshold1');
      expect(configServiceContent).toContain('store.set(config.threshold2');
    });

    it('saves colors to iCloud store', () => {
      expect(configServiceContent).toContain('progressConfig.lowColor');
      expect(configServiceContent).toContain('progressConfig.mediumColor');
      expect(configServiceContent).toContain('progressConfig.highColor');
    });

    it('calls synchronize after saving', () => {
      expect(configServiceContent).toContain('store.synchronize()');
    });

    it('defines loadProgressConfig function', () => {
      expect(configServiceContent).toContain('func loadProgressConfig() -> ProgressBarConfig');
    });

    it('loads thresholds from store with defaults', () => {
      expect(configServiceContent).toContain('store.object(forKey: ConfigKeys.lowThreshold)');
      expect(configServiceContent).toContain('store.object(forKey: ConfigKeys.mediumThreshold)');
    });

    it('supports showProgressBars toggle persistence', () => {
      expect(configServiceContent).toContain('func saveShowProgressBars');
      expect(configServiceContent).toContain('func loadShowProgressBars');
      expect(configServiceContent).toContain('progressConfig.showProgressBars');
    });

    it('ProgressConfigView saves config on button press', () => {
      expect(progressConfigViewContent).toContain('func saveConfig()');
      expect(progressConfigViewContent).toContain('configService.saveProgressConfig(config:');
      expect(progressConfigViewContent).toContain('configService.saveShowProgressBars');
    });

    it('shows sync status after saving', () => {
      expect(progressConfigViewContent).toContain('syncStatus = .saving');
      expect(progressConfigViewContent).toContain('syncStatus = .saved');
      expect(progressConfigViewContent).toContain('Saved to iCloud');
    });
  });

  describe('validateAndPreview rejects invalid threshold configuration', () => {
    it('defines validateAndPreview function', () => {
      expect(progressConfigViewContent).toContain(
        'func validateAndPreview(config: ProgressBarConfig) -> ProgressBarState'
      );
    });

    it('rejects when mediumThreshold <= lowThreshold', () => {
      expect(progressConfigViewContent).toContain('config.threshold1 < config.threshold2');
      expect(progressConfigViewContent).toContain(
        'Low threshold must be less than medium threshold'
      );
    });

    it('rejects negative threshold values', () => {
      expect(progressConfigViewContent).toContain('config.threshold1 >= 0');
      expect(progressConfigViewContent).toContain('config.threshold2 >= 0');
      expect(progressConfigViewContent).toContain(
        'Threshold values must be non-negative'
      );
    });

    it('sets validationError on invalid config', () => {
      expect(progressConfigViewContent).toContain('validationError =');
    });

    it('displays validation error in the view', () => {
      expect(progressConfigViewContent).toContain('viewModel.validationError');
      expect(progressConfigViewContent).toContain('.foregroundColor(.red)');
    });

    it('disables save button when validation error exists', () => {
      expect(progressConfigViewContent).toContain(
        '.disabled(viewModel.validationError != nil'
      );
    });

    it('returns a default preview state on validation failure', () => {
      expect(progressConfigViewContent).toContain('defaultPreviewState()');
    });

    it('ProgressConfigurationError is available from types', () => {
      expect(errorsTypesContent).toContain(
        'export class ProgressConfigurationError extends Error'
      );
      expect(errorsTypesContent).toContain('code: string');
      expect(errorsTypesContent).toContain('threshold?: ProgressThreshold');
    });
  });

  describe('ProgressConfigView updates preview in real-time as user adjusts settings', () => {
    it('defines ProgressConfigView struct', () => {
      expect(progressConfigViewContent).toContain('struct ProgressConfigView: View');
    });

    it('uses @StateObject for reactive view model', () => {
      expect(progressConfigViewContent).toContain(
        '@StateObject private var viewModel = ProgressConfigViewModel()'
      );
    });

    it('has slider inputs for thresholds', () => {
      expect(progressConfigViewContent).toContain(
        'Slider(value: $viewModel.lowThreshold'
      );
      expect(progressConfigViewContent).toContain(
        'Slider(value: $viewModel.mediumThreshold'
      );
    });

    it('has color pickers for each threshold level', () => {
      expect(progressConfigViewContent).toContain('ColorPickerRow(label:');
      expect(progressConfigViewContent).toContain('$viewModel.lowColor');
      expect(progressConfigViewContent).toContain('$viewModel.mediumColor');
      expect(progressConfigViewContent).toContain('$viewModel.highColor');
    });

    it('has a toggle for enabling/disabling progress bars', () => {
      expect(progressConfigViewContent).toContain(
        'Toggle("Show Progress Bars in Widgets"'
      );
      expect(progressConfigViewContent).toContain('$viewModel.showProgressBars');
    });

    it('has a preview section showing the progress bar', () => {
      expect(progressConfigViewContent).toContain('ProgressBarView(config:');
      expect(progressConfigViewContent).toContain('viewModel.previewState');
    });

    it('preview updates reactively via computed previewState', () => {
      expect(progressConfigViewContent).toContain('var previewState: ProgressBarState');
      expect(progressConfigViewContent).toContain(
        'return validateAndPreview(config: buildCurrentConfig())'
      );
    });

    it('builds config from current slider and color values', () => {
      expect(progressConfigViewContent).toContain('func buildCurrentConfig() -> ProgressBarConfig');
      expect(progressConfigViewContent).toContain('threshold1: lowThreshold');
      expect(progressConfigViewContent).toContain('threshold2: mediumThreshold');
    });

    it('displays threshold percentage labels', () => {
      expect(progressConfigViewContent).toContain('Low Threshold:');
      expect(progressConfigViewContent).toContain('Medium Threshold:');
    });

    it('shows current threshold level in preview', () => {
      expect(progressConfigViewContent).toContain(
        'viewModel.previewState.threshold'
      );
    });
  });

  describe('ColorPickerRow component', () => {
    it('defines ColorPickerRow struct conforming to View', () => {
      expect(colorPickerRowContent).toContain('struct ColorPickerRow: View');
    });

    it('has label and color binding', () => {
      expect(colorPickerRowContent).toContain('let label: String');
      expect(colorPickerRowContent).toContain('@Binding var color: Color');
    });

    it('uses SwiftUI ColorPicker', () => {
      expect(colorPickerRowContent).toContain('ColorPicker(');
    });

    it('has accessibility labels', () => {
      expect(colorPickerRowContent).toContain('.accessibilityLabel(');
    });
  });

  describe('TypeScript type definitions', () => {
    it('exports ProgressBarConfig with threshold fields', () => {
      expect(progressTypesContent).toContain('export interface ProgressBarConfig');
      expect(progressTypesContent).toContain('lowThreshold: number');
      expect(progressTypesContent).toContain('mediumThreshold: number');
      expect(progressTypesContent).toContain('highThreshold: number');
    });

    it('exports ProgressBarState', () => {
      expect(progressTypesContent).toContain('export interface ProgressBarState');
      expect(progressTypesContent).toContain('percentage: number');
      expect(progressTypesContent).toContain("threshold: 'low' | 'medium' | 'high'");
    });

    it('exports ProgressThreshold type', () => {
      expect(progressTypesContent).toContain(
        "export type ProgressThreshold = 'low' | 'medium' | 'high'"
      );
    });

    it('WidgetConfiguration has showProgressBars and progressConfig', () => {
      expect(widgetTypesContent).toContain('export interface WidgetConfiguration');
      expect(widgetTypesContent).toContain('showProgressBars: boolean');
      expect(widgetTypesContent).toContain('progressConfig: ProgressBarConfig');
    });
  });
});
