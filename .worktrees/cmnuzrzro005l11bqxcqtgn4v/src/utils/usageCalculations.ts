import { UsageData, UsagePercentages, UsageThreshold } from '../types/usage';

export function calculateUsagePercentages(data: UsageData): UsagePercentages {
  return {
    tokensPercentage: data.tokensLimit > 0 ? (data.tokensUsed / data.tokensLimit) * 100 : 0,
    messagesPercentage: data.messagesLimit > 0 ? (data.messagesUsed / data.messagesLimit) * 100 : 0,
  };
}

export function determineThreshold(percentage: number): UsageThreshold {
  if (percentage >= 90) return 'critical';
  if (percentage >= 75) return 'high';
  if (percentage >= 50) return 'medium';
  return 'low';
}
