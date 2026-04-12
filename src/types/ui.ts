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
