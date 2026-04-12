export interface ProgressColors {
  low: string;
  medium: string;
  high: string;
  background: string;
}

export interface ProgressBarConfig {
  value: number;
  threshold1: number;
  threshold2: number;
  colors: ProgressColors;
}

export interface ProgressBarConfiguration {
  lowThreshold: number;
  mediumThreshold: number;
  highThreshold: number;
  colors: ProgressColors;
}
