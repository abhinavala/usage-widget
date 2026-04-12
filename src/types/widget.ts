import { UsageData } from './sync';

export enum WidgetSize {
  SMALL = 'small',
  MEDIUM = 'medium',
}

export interface WidgetConfiguration {
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
  configuration: WidgetConfiguration;
}

export interface TimelineConfiguration {
  refreshInterval: number;
  maxEntries: number;
  staleThreshold: number;
}
