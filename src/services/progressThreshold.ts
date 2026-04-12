import { ProgressBarConfig, ProgressBarState, ProgressThreshold } from '../types/progress';
import { ProgressConfigurationError, ColorValidationError } from '../types/errors';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function getDefaultProgressConfig(): ProgressBarConfig {
  return {
    lowThreshold: 60,
    mediumThreshold: 85,
    highThreshold: 100,
    lowColor: '#34C759',
    mediumColor: '#FFD60A',
    highColor: '#FF3B30',
  };
}

export function validateProgressConfig(config: ProgressBarConfig): void {
  validateColor(config.lowColor);
  validateColor(config.mediumColor);
  validateColor(config.highColor);

  if (config.lowThreshold < 0 || config.mediumThreshold < 0 || config.highThreshold < 0) {
    const error = new ProgressConfigurationError('Threshold values must be non-negative');
    error.code = 'INVALID_THRESHOLD_VALUE';
    throw error;
  }

  if (
    config.lowThreshold >= config.mediumThreshold ||
    config.mediumThreshold >= config.highThreshold
  ) {
    const error = new ProgressConfigurationError(
      'Thresholds must be in ascending order: low < medium < high'
    );
    error.code = 'INVALID_THRESHOLD_ORDER';
    throw error;
  }
}

export function calculateProgressState(
  value: number,
  total: number,
  config: ProgressBarConfig
): ProgressBarState {
  validateProgressConfig(config);

  if (total <= 0) {
    return { value, percentage: 0, color: config.lowColor, threshold: 'low' };
  }

  const rawPercentage = (value / total) * 100;
  const percentage = Math.min(Math.max(Math.round(rawPercentage), 0), 100);

  const threshold = getThreshold(percentage, config);
  const color = getColorForThreshold(threshold, config);

  return { value, percentage, color, threshold };
}

function getThreshold(percentage: number, config: ProgressBarConfig): ProgressThreshold {
  if (percentage < config.lowThreshold) {
    return 'low';
  }
  if (percentage < config.mediumThreshold) {
    return 'medium';
  }
  return 'high';
}

function getColorForThreshold(threshold: ProgressThreshold, config: ProgressBarConfig): string {
  switch (threshold) {
    case 'low':
      return config.lowColor;
    case 'medium':
      return config.mediumColor;
    case 'high':
      return config.highColor;
  }
}

function validateColor(color: string): void {
  if (!HEX_COLOR_REGEX.test(color)) {
    const error = new ColorValidationError(`Invalid hex color format: ${color}`);
    error.code = 'INVALID_COLOR_FORMAT';
    error.color = color;
    throw error;
  }
}
