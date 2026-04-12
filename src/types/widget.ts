import { UsageData } from './sync';
import { ProgressBarConfig, ProgressBarState } from './progress';

export enum WidgetSize {
  SMALL = 'small',
  MEDIUM = 'medium',
}

export type ColorTheme = 'light' | 'dark' | 'auto';

export interface WidgetConfiguration {
  size: WidgetSize;
  showResetTime: boolean;
  colorTheme: ColorTheme;
  showProgressBars: boolean;
  progressConfig: ProgressBarConfig;
}

export interface TimelineWidgetConfiguration {
  showTokens: boolean;
  showRequests: boolean;
  size: WidgetSize;
  refreshInterval: number;
}

export interface WidgetEntry {
  date: Date;
  usageData: UsageData | null;
  configuration: WidgetConfiguration;
}

export interface TimelineEntry {
  date: Date;
  usageData: UsageData;
  configuration: TimelineWidgetConfiguration;
}

export interface TimelineConfiguration {
  refreshInterval: number;
  maxEntries: number;
  staleThreshold: number;
}

export interface WidgetData { usage: UsageData; progress: ProgressBarState; size: WidgetSize; config: WidgetConfiguration; } // src/types/widget.ts
