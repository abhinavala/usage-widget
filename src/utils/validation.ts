import { UsageData } from '../types/usage';

export function validateUsageData(data: unknown): data is UsageData {
  if (data === null || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (typeof obj.tokensUsed !== 'number' || obj.tokensUsed < 0) return false;
  if (typeof obj.tokensLimit !== 'number' || obj.tokensLimit < 0) return false;
  if (typeof obj.messagesUsed !== 'number' || obj.messagesUsed < 0) return false;
  if (typeof obj.messagesLimit !== 'number' || obj.messagesLimit < 0) return false;
  if (!(obj.resetTime instanceof Date) || isNaN(obj.resetTime.getTime())) return false;
  if (!(obj.lastUpdated instanceof Date) || isNaN(obj.lastUpdated.getTime())) return false;

  return true;
}
