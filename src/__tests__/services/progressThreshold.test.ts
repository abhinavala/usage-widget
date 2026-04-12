import { describe, it, expect } from 'vitest';
import {
  calculateProgressState,
  validateProgressConfig,
  getDefaultProgressConfig,
} from '../../services/progressThreshold';
import { ProgressBarConfig } from '../../types/progress';
import { ProgressConfigurationError, ColorValidationError } from '../../types/errors';

function createConfig(overrides: Partial<ProgressBarConfig> = {}): ProgressBarConfig {
  return { ...getDefaultProgressConfig(), ...overrides };
}

describe('getDefaultProgressConfig', () => {
  it('returns valid default config', () => {
    const config = getDefaultProgressConfig();
    expect(config.lowThreshold).toBe(60);
    expect(config.mediumThreshold).toBe(85);
    expect(config.highThreshold).toBe(100);
    expect(config.lowColor).toBe('#34C759');
    expect(config.mediumColor).toBe('#FFD60A');
    expect(config.highColor).toBe('#FF3B30');
  });
});

describe('validateProgressConfig', () => {
  it('accepts valid config', () => {
    expect(() => validateProgressConfig(getDefaultProgressConfig())).not.toThrow();
  });

  it('throws error for invalid threshold order', () => {
    const config = createConfig({ lowThreshold: 90, mediumThreshold: 50 });
    expect(() => validateProgressConfig(config)).toThrow(ProgressConfigurationError);
    try {
      validateProgressConfig(config);
    } catch (e) {
      expect((e as ProgressConfigurationError).code).toBe('INVALID_THRESHOLD_ORDER');
    }
  });

  it('throws error for equal thresholds', () => {
    const config = createConfig({ lowThreshold: 60, mediumThreshold: 60 });
    expect(() => validateProgressConfig(config)).toThrow(ProgressConfigurationError);
  });

  it('throws error for negative threshold', () => {
    const config = createConfig({ lowThreshold: -10 });
    expect(() => validateProgressConfig(config)).toThrow(ProgressConfigurationError);
    try {
      validateProgressConfig(config);
    } catch (e) {
      expect((e as ProgressConfigurationError).code).toBe('INVALID_THRESHOLD_VALUE');
    }
  });

  it('throws error for invalid color format', () => {
    const config = createConfig({ lowColor: 'not-a-color' });
    expect(() => validateProgressConfig(config)).toThrow(ColorValidationError);
    try {
      validateProgressConfig(config);
    } catch (e) {
      const err = e as ColorValidationError;
      expect(err.code).toBe('INVALID_COLOR_FORMAT');
      expect(err.color).toBe('not-a-color');
    }
  });

  it('accepts 3-digit hex colors', () => {
    const config = createConfig({ lowColor: '#0F0' });
    expect(() => validateProgressConfig(config)).not.toThrow();
  });

  it('accepts 8-digit hex colors with alpha', () => {
    const config = createConfig({ lowColor: '#34C759FF' });
    expect(() => validateProgressConfig(config)).not.toThrow();
  });
});

describe('calculateProgressState', () => {
  const config = getDefaultProgressConfig();

  it('returns low threshold state for 45% usage', () => {
    const result = calculateProgressState(45, 100, config);
    expect(result.threshold).toBe('low');
    expect(result.percentage).toBe(45);
    expect(result.color).toBe(config.lowColor);
    expect(result.value).toBe(45);
  });

  it('returns medium threshold state for 70% usage', () => {
    const result = calculateProgressState(70, 100, config);
    expect(result.threshold).toBe('medium');
    expect(result.percentage).toBe(70);
    expect(result.color).toBe(config.mediumColor);
  });

  it('returns high threshold state for 90% usage', () => {
    const result = calculateProgressState(90, 100, config);
    expect(result.threshold).toBe('high');
    expect(result.percentage).toBe(90);
    expect(result.color).toBe(config.highColor);
  });

  it('handles over 100% usage correctly', () => {
    const result = calculateProgressState(150, 100, config);
    expect(result.percentage).toBe(100);
    expect(result.value).toBe(150);
    expect(result.threshold).toBe('high');
  });

  it('handles zero total gracefully', () => {
    const result = calculateProgressState(50, 0, config);
    expect(result.percentage).toBe(0);
    expect(result.threshold).toBe('low');
    expect(result.color).toBe(config.lowColor);
  });

  it('handles negative value', () => {
    const result = calculateProgressState(-10, 100, config);
    expect(result.percentage).toBe(0);
    expect(result.threshold).toBe('low');
  });

  it('returns exact boundary values correctly', () => {
    const result60 = calculateProgressState(60, 100, config);
    expect(result60.threshold).toBe('medium');

    const result85 = calculateProgressState(85, 100, config);
    expect(result85.threshold).toBe('high');
  });

  it('throws for invalid config', () => {
    const badConfig = createConfig({ lowThreshold: 90, mediumThreshold: 50 });
    expect(() => calculateProgressState(50, 100, badConfig)).toThrow(
      ProgressConfigurationError
    );
  });
});
