export interface UsageData {
  inputTokens: number;
  outputTokens: number;
  inputLimit: number;
  outputLimit: number;
  resetTime: Date;
  lastUpdated: Date;
}

export interface ManualOverride {
  enabled: boolean;
  inputPercentage?: number;
  outputPercentage?: number;
  resetTime?: Date;
}
