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

/**
 * Returns the supported widget families.
 */
export function supportedFamilies(): WidgetSize[] {
  return [WidgetSize.Small, WidgetSize.Medium];
}

/**
 * Generates timeline entries for a given widget size.
 */
export function generateTimelineEntries(
  size: WidgetSize,
  usageData: UsageData | null,
  config?: Partial<TimelineConfiguration>
): WidgetEntry[] {
  const refreshInterval = config?.refreshInterval ?? 60_000; // 1 minute in ms
  const maxEntries = config?.maxEntries ?? 60;
  const now = new Date();

  const entries: WidgetEntry[] = [];

  for (let i = 0; i < maxEntries; i++) {
    entries.push({
      date: new Date(now.getTime() + i * refreshInterval),
      usageData,
      configuration: { size },
    });
  }

  return entries;
}
