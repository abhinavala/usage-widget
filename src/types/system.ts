export interface LaunchAgentConfig {
  keepAlive: boolean;
  runAtLoad: boolean;
  startInterval: number;
}

export type AppVisibility = 'visible' | 'hidden' | 'background';

export interface SystemStatus {
  isRunning: boolean;
  lastFetchTime?: Date;
  nextFetchTime?: Date;
  visibility: AppVisibility;
}
