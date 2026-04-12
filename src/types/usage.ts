export interface UsageData {
  tokensUsed: number;
  tokensLimit: number;
  messagesUsed: number;
  messagesLimit: number;
  resetTime: Date;
  lastUpdated: Date;
}

export interface UsagePercentages {
  tokensPercentage: number;
  messagesPercentage: number;
}

export type UsageThreshold = 'low' | 'medium' | 'high' | 'critical';
