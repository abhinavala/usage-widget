import { UsageData } from './sync';

export enum WidgetSize {
  SMALL = 'small',
  MEDIUM = 'medium',
}

export type ColorTheme = 'light' | 'dark' | 'auto';

export interface WidgetConfiguration {
  size: WidgetSize;
  showResetTime: boolean;
  colorTheme: ColorTheme;
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
