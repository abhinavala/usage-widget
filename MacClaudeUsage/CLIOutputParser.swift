import { UsageData } from '../src/types/usage';
import { FetchError } from './CLICommandRunner.swift';

export interface RawCLIResponse {
  tokensUsed?: number;
  tokensLimit?: number;
  messagesUsed?: number;
  messagesLimit?: number;
  resetTime?: string;
  [key: string]: unknown;
}

export function parseCLIOutput(raw: string): UsageData {
  if (!raw || typeof raw !== 'string') {
    throw new FetchError('Empty or invalid CLI output', 'PARSE_EMPTY', 'cli', false);
  }

  let parsed: RawCLIResponse;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new FetchError('Failed to parse CLI output as JSON', 'PARSE_JSON_ERROR', 'cli', false);
  }

  return mapToUsageData(parsed);
}

export function mapToUsageData(raw: RawCLIResponse): UsageData {
  const tokensUsed = extractNumber(raw, 'tokensUsed', 'tokens_used');
  const tokensLimit = extractNumber(raw, 'tokensLimit', 'tokens_limit');
  const messagesUsed = extractNumber(raw, 'messagesUsed', 'messages_used');
  const messagesLimit = extractNumber(raw, 'messagesLimit', 'messages_limit');
  const resetTime = extractDate(raw, 'resetTime', 'reset_time');

  if (tokensUsed === undefined || tokensLimit === undefined) {
    throw new FetchError('Missing required token usage fields', 'PARSE_MISSING_FIELDS', 'cli', false);
  }

  return {
    tokensUsed,
    tokensLimit,
    messagesUsed: messagesUsed ?? 0,
    messagesLimit: messagesLimit ?? 0,
    resetTime: resetTime ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastUpdated: new Date(),
  };
}

function extractNumber(obj: RawCLIResponse, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && value >= 0) return value;
    if (typeof value === 'string') {
      const num = Number(value);
      if (!isNaN(num) && num >= 0) return num;
    }
  }
  return undefined;
}

function extractDate(obj: RawCLIResponse, ...keys: string[]): Date | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date;
    }
  }
  return undefined;
}
