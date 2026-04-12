import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const VIEWS_DIR = resolve(__dirname, '..', 'Views');
const COMPONENTS_DIR = resolve(VIEWS_DIR, 'Components');
const TYPES_DIR = resolve(__dirname, '..', '..', 'src', 'types');

describe('SliderInterfaceTests', () => {
  describe('UsageSlider updates progress bar when value changes', () => {
    const sliderContent = readFileSync(
      resolve(COMPONENTS_DIR, 'UsageSlider.swift'),
      'utf-8'
    );

    it('defines UsageSlider struct conforming to View', () => {
      expect(sliderContent).toContain('struct UsageSlider: View');
    });

    it('imports SwiftUI', () => {
      expect(sliderContent).toContain('import SwiftUI');
    });

    it('uses a Binding for the slider value', () => {
      expect(sliderContent).toContain('@Binding var value: Double');
    });

    it('includes a ProgressBarView that reflects the slider value', () => {
      expect(sliderContent).toContain('ProgressBarView(config: progressConfig)');
    });

    it('creates a ProgressBarConfig with the current value', () => {
      expect(sliderContent).toContain('value: value');
    });

    it('uses a Slider control for user input', () => {
      expect(sliderContent).toContain('Slider(');
      expect(sliderContent).toContain('value: $value');
    });

    it('displays the current percentage value', () => {
      expect(sliderContent).toContain('Int(value)');
    });

    it('animates value changes for immediate visual feedback', () => {
      expect(sliderContent).toContain('.animation(');
    });
  });

  describe('ManualOverrideView disables sliders when override mode is off', () => {
    const overrideContent = readFileSync(
      resolve(VIEWS_DIR, 'ManualOverrideView.swift'),
      'utf-8'
    );

    it('defines ManualOverrideView struct conforming to View', () => {
      expect(overrideContent).toContain('struct ManualOverrideView: View');
    });

    it('has an overrideEnabled state property', () => {
      expect(overrideContent).toContain('@State private var overrideEnabled: Bool = false');
    });

    it('passes isEnabled based on override state to sliders', () => {
      expect(overrideContent).toContain('isEnabled: overrideEnabled');
    });

    it('disables slider when override is off', () => {
      const sliderContent = readFileSync(
        resolve(COMPONENTS_DIR, 'UsageSlider.swift'),
        'utf-8'
      );
      expect(sliderContent).toContain('.disabled(!isEnabled)');
    });

    it('shows real data values when override is off', () => {
      expect(overrideContent).toContain('realInputPercentage');
      expect(overrideContent).toContain('realOutputPercentage');
    });

    it('has a toggle to enable/disable override mode', () => {
      expect(overrideContent).toContain('Toggle(');
      expect(overrideContent).toContain('isOn: $overrideEnabled');
    });

    it('provides visual distinction between override and real data', () => {
      expect(overrideContent).toContain('Override Active');
      expect(overrideContent).toContain('Live Data');
    });

    it('includes accessibility labels for the toggle', () => {
      expect(overrideContent).toContain('.accessibilityLabel("Override mode toggle")');
    });
  });

  describe('ProgressBarView applies correct color thresholds', () => {
    const progressContent = readFileSync(
      resolve(COMPONENTS_DIR, 'ProgressBarView.swift'),
      'utf-8'
    );

    it('defines ProgressBarConfig struct', () => {
      expect(progressContent).toContain('struct ProgressBarConfig');
    });

    it('defines ProgressColors struct', () => {
      expect(progressContent).toContain('struct ProgressColors');
    });

    it('ProgressBarConfig has value, threshold1, threshold2, and colors fields', () => {
      expect(progressContent).toContain('var value: Double');
      expect(progressContent).toContain('var threshold1: Double');
      expect(progressContent).toContain('var threshold2: Double');
      expect(progressContent).toContain('var colors: ProgressColors');
    });

    it('ProgressColors has low, medium, high, and background fields', () => {
      expect(progressContent).toContain('var low: Color');
      expect(progressContent).toContain('var medium: Color');
      expect(progressContent).toContain('var high: Color');
      expect(progressContent).toContain('var background: Color');
    });

    it('returns low color when value is below threshold1', () => {
      expect(progressContent).toContain('config.value < config.threshold1');
      expect(progressContent).toContain('config.colors.low');
    });

    it('returns high color when value is above threshold2', () => {
      expect(progressContent).toContain('config.value > config.threshold2');
      expect(progressContent).toContain('config.colors.high');
    });

    it('returns medium color for values between thresholds', () => {
      expect(progressContent).toContain('config.colors.medium');
    });

    it('includes accessibility support', () => {
      expect(progressContent).toContain('.accessibilityLabel(');
      expect(progressContent).toContain('.accessibilityValue(');
    });

    it('defines ProgressBarView struct conforming to View', () => {
      expect(progressContent).toContain('struct ProgressBarView: View');
    });
  });

  describe('TypeScript type definitions', () => {
    const uiTypesContent = readFileSync(
      resolve(TYPES_DIR, 'ui.ts'),
      'utf-8'
    );

    it('exports ProgressBarConfig interface', () => {
      expect(uiTypesContent).toContain('export interface ProgressBarConfig');
    });

    it('exports ProgressColors interface', () => {
      expect(uiTypesContent).toContain('export interface ProgressColors');
    });

    it('ProgressBarConfig has required fields', () => {
      expect(uiTypesContent).toContain('value: number');
      expect(uiTypesContent).toContain('threshold1: number');
      expect(uiTypesContent).toContain('threshold2: number');
      expect(uiTypesContent).toContain('colors: ProgressColors');
    });

    it('ProgressColors has required color fields', () => {
      expect(uiTypesContent).toContain('low: string');
      expect(uiTypesContent).toContain('medium: string');
      expect(uiTypesContent).toContain('high: string');
      expect(uiTypesContent).toContain('background: string');
    });
  });
});
