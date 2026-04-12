export interface ProgressColors {
  low: string;
  medium: string;
  high: string;
  critical: string;
}

export interface ProgressBarConfiguration {
  lowThreshold: number;
  mediumThreshold: number;
  highThreshold: number;
  colors: ProgressColors;
}
