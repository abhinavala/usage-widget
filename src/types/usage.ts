export interface UsageData {
  inputTokens: number;
  outputTokens: number;
  inputLimit: number;
  outputLimit: number;
  resetTime: Date;
  lastUpdated: Date;
  manualOverride?: ManualOverride;
}

export interface ManualOverride {
  enabled: boolean;
  inputPercentage?: number;
  outputPercentage?: number;
  resetTime?: Date;
  createdAt?: Date;
}

export function isUsingOverrides(data: UsageData): boolean {
  return data.manualOverride?.enabled === true;
}

export function getEffectiveUsage(data: UsageData): UsageData {
  const override = data.manualOverride;
  if (!override || !override.enabled) {
    return data;
  }

  const effective: UsageData = { ...data };

  if (override.inputPercentage !== undefined) {
    effective.inputTokens = Math.floor(
      data.inputLimit * override.inputPercentage / 100
    );
  }

  if (override.outputPercentage !== undefined) {
    effective.outputTokens = Math.floor(
      data.outputLimit * override.outputPercentage / 100
    );
  }

  if (override.resetTime !== undefined) {
    effective.resetTime = override.resetTime;
  }

  return effective;
}

export function applyManualOverride(
  data: UsageData,
  override: ManualOverride
): UsageData {
  return { ...data, manualOverride: override };
}
