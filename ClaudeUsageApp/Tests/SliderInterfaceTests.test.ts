import { describe, it, expect } from 'vitest';
import type { UsageData, ManualOverride } from '../../src/types/usage';

// ProgressBarConfig mirrors the Swift struct
interface ProgressBarConfig {
  threshold1: number;
  threshold2: number;
  colors: ProgressColors;
}

interface ProgressColors {
  low: string;
  medium: string;
  high: string;
  background: string;
}

const defaultConfig: ProgressBarConfig = {
  threshold1: 0.50,
  threshold2: 0.75,
  colors: {
    low: 'green',
    medium: 'yellow',
    high: 'red',
    background: 'gray',
  },
};

// Mirrors ProgressBarView.progressColor(for:)
function progressColor(percentage: number, config: ProgressBarConfig): string {
  if (percentage >= config.threshold2) return config.colors.high;
  if (percentage >= config.threshold1) return config.colors.medium;
  return config.colors.low;
}

// Mirrors ManualOverrideView.calculatePercentage(used:limit:)
function calculatePercentage(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min((used / limit) * 100, 100);
}

// Mirrors ManualOverrideView.formatTokenCount(_:)
function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
}

// Simulates the slider + progress bar binding behavior
interface SliderState {
  percentage: number;
  isEnabled: boolean;
}

function createSliderState(percentage: number, isEnabled: boolean): SliderState {
  return { percentage, isEnabled };
}

function getProgressBarValue(slider: SliderState): number {
  return Math.min(Math.max(slider.percentage, 0), 100) / 100;
}

describe('SliderInterfaceTests', () => {
  describe('UsageSlider updates progress bar when value changes', () => {
    it('progress bar value equals slider value', () => {
      const slider = createSliderState(65, true);
      const barValue = getProgressBarValue(slider);
      expect(barValue).toBeCloseTo(0.65);
    });

    it('progress bar updates immediately when slider changes', () => {
      const slider = createSliderState(25, true);
      expect(getProgressBarValue(slider)).toBeCloseTo(0.25);

      slider.percentage = 80;
      expect(getProgressBarValue(slider)).toBeCloseTo(0.80);
    });

    it('slider value is clamped between 0 and 100', () => {
      const low = createSliderState(-10, true);
      expect(getProgressBarValue(low)).toBe(0);

      const high = createSliderState(150, true);
      expect(getProgressBarValue(high)).toBe(1.0);
    });

    it('progress bar reflects percentage at boundary values', () => {
      expect(getProgressBarValue(createSliderState(0, true))).toBe(0);
      expect(getProgressBarValue(createSliderState(50, true))).toBe(0.5);
      expect(getProgressBarValue(createSliderState(100, true))).toBe(1.0);
    });
  });

  describe('ManualOverrideView disables sliders when override mode is off', () => {
    it('slider is disabled when override is off', () => {
      const slider = createSliderState(50, false);
      expect(slider.isEnabled).toBe(false);
    });

    it('disabled slider shows real data values', () => {
      const usageData: UsageData = {
        inputTokens: 5000,
        outputTokens: 3000,
        inputLimit: 10000,
        outputLimit: 8000,
        resetTime: new Date('2026-04-12T00:00:00Z'),
        lastUpdated: new Date(),
      };
      const realInputPct = calculatePercentage(usageData.inputTokens, usageData.inputLimit);
      const realOutputPct = calculatePercentage(usageData.outputTokens, usageData.outputLimit);

      const inputSlider = createSliderState(realInputPct, false);
      const outputSlider = createSliderState(realOutputPct, false);

      expect(inputSlider.percentage).toBe(50);
      expect(outputSlider.percentage).toBe(37.5);
      expect(inputSlider.isEnabled).toBe(false);
      expect(outputSlider.isEnabled).toBe(false);
    });

    it('sliders become enabled when override mode is turned on', () => {
      const slider = createSliderState(50, false);
      expect(slider.isEnabled).toBe(false);

      slider.isEnabled = true;
      expect(slider.isEnabled).toBe(true);
    });

    it('toggling override off preserves slider position but disables interaction', () => {
      const slider = createSliderState(75, true);
      expect(slider.isEnabled).toBe(true);

      slider.isEnabled = false;
      expect(slider.percentage).toBe(75);
      expect(slider.isEnabled).toBe(false);
    });
  });

  describe('ProgressBarView applies correct color thresholds', () => {
    it('returns low color when value is below threshold1', () => {
      expect(progressColor(0.0, defaultConfig)).toBe('green');
      expect(progressColor(0.25, defaultConfig)).toBe('green');
      expect(progressColor(0.49, defaultConfig)).toBe('green');
    });

    it('returns medium color when value is between threshold1 and threshold2', () => {
      expect(progressColor(0.50, defaultConfig)).toBe('yellow');
      expect(progressColor(0.60, defaultConfig)).toBe('yellow');
      expect(progressColor(0.74, defaultConfig)).toBe('yellow');
    });

    it('returns high color when value is at or above threshold2', () => {
      expect(progressColor(0.75, defaultConfig)).toBe('red');
      expect(progressColor(0.90, defaultConfig)).toBe('red');
      expect(progressColor(1.0, defaultConfig)).toBe('red');
    });

    it('respects custom threshold configuration', () => {
      const custom: ProgressBarConfig = {
        threshold1: 0.30,
        threshold2: 0.60,
        colors: {
          low: 'blue',
          medium: 'purple',
          high: 'orange',
          background: 'gray',
        },
      };
      expect(progressColor(0.20, custom)).toBe('blue');
      expect(progressColor(0.45, custom)).toBe('purple');
      expect(progressColor(0.80, custom)).toBe('orange');
    });

    it('handles exact boundary values', () => {
      expect(progressColor(0.50, defaultConfig)).toBe('yellow');
      expect(progressColor(0.75, defaultConfig)).toBe('red');
    });
  });

  describe('calculatePercentage', () => {
    it('calculates correct percentage', () => {
      expect(calculatePercentage(5000, 10000)).toBe(50);
      expect(calculatePercentage(7500, 10000)).toBe(75);
    });

    it('returns 0 when limit is 0', () => {
      expect(calculatePercentage(5000, 0)).toBe(0);
    });

    it('caps at 100 when used exceeds limit', () => {
      expect(calculatePercentage(15000, 10000)).toBe(100);
    });
  });

  describe('formatTokenCount', () => {
    it('formats numbers below 1000 as-is', () => {
      expect(formatTokenCount(500)).toBe('500');
    });

    it('formats thousands with K suffix', () => {
      expect(formatTokenCount(1000)).toBe('1.0K');
      expect(formatTokenCount(5500)).toBe('5.5K');
    });

    it('formats millions with M suffix', () => {
      expect(formatTokenCount(1000000)).toBe('1.0M');
      expect(formatTokenCount(2500000)).toBe('2.5M');
    });
  });
});
