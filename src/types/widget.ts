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

export interface TimelineEntry {
  date: Date;
  usageData: UsageData;
  configuration: WidgetConfiguration;
}
