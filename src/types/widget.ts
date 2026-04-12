import { UsageData } from './usage';

export enum WidgetSize {
  Small = 'small',
  Medium = 'medium',
}

export interface WidgetConfiguration {
  size: WidgetSize;
}

export interface WidgetEntry {
  date: Date;
  usageData: UsageData | null;
  configuration: WidgetConfiguration;
}

export interface TimelineConfiguration {
  refreshInterval: number;
  maxEntries: number;
  staleThreshold: number;
}
