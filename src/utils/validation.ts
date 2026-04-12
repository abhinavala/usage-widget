import { UsageData } from '../types/usage';

export function validateUsageData(data: unknown): data is UsageData {
  if (data === null || data === undefined || typeof data !== 'object') {
    return false;
  }

  const d = data as Record<string, unknown>;

  if (typeof d.tokensUsed !== 'number' || d.tokensUsed < 0) return false;
  if (typeof d.tokensLimit !== 'number' || d.tokensLimit < 0) return false;
  if (typeof d.messagesUsed !== 'number' || d.messagesUsed < 0) return false;
  if (typeof d.messagesLimit !== 'number' || d.messagesLimit < 0) return false;

  if (!(d.resetTime instanceof Date) || isNaN(d.resetTime.getTime())) return false;
  if (!(d.lastUpdated instanceof Date) || isNaN(d.lastUpdated.getTime())) return false;

  return true;
}
