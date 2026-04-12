import { describe, it, expect } from 'vitest';
import { UsageData, UsagePercentages, UsageThreshold } from '../../types/usage';
import { UsageFetcher, FetcherType, FetcherConfig } from '../../types/fetcher';
import { UsageFetchError, SyncError, AuthError } from '../../types/errors';
import { calculateUsagePercentages, determineThreshold } from '../../utils/usageCalculations';
import { validateUsageData } from '../../utils/validation';

function createValidUsageData(overrides: Partial<UsageData> = {}): UsageData {
  return {
    tokensUsed: 5000,
    tokensLimit: 10000,
    messagesUsed: 25,
    messagesLimit: 100,
    resetTime: new Date('2026-04-12T00:00:00Z'),
    lastUpdated: new Date('2026-04-11T12:00:00Z'),
    ...overrides,
  };
}

describe('UsageData types', () => {
  it('should create a valid UsageData object', () => {
    const data = createValidUsageData();
    expect(data.tokensUsed).toBe(5000);
    expect(data.tokensLimit).toBe(10000);
    expect(data.messagesUsed).toBe(25);
    expect(data.messagesLimit).toBe(100);
    expect(data.resetTime).toBeInstanceOf(Date);
    expect(data.lastUpdated).toBeInstanceOf(Date);
  });

  it('should create a valid UsagePercentages object', () => {
    const percentages: UsagePercentages = {
      tokensPercentage: 50,
      messagesPercentage: 25,
    };
    expect(percentages.tokensPercentage).toBe(50);
    expect(percentages.messagesPercentage).toBe(25);
  });

  it('should accept valid UsageThreshold values', () => {
    const thresholds: UsageThreshold[] = ['low', 'medium', 'high', 'critical'];
    expect(thresholds).toHaveLength(4);
  });
});

describe('Fetcher types', () => {
  it('should accept valid FetcherType values', () => {
    const types: FetcherType[] = ['webapi', 'cli'];
    expect(types).toHaveLength(2);
  });

  it('should create a valid FetcherConfig object', () => {
    const config: FetcherConfig = {
      type: 'webapi',
      timeout: 5000,
      retryAttempts: 3,
    };
    expect(config.type).toBe('webapi');
    expect(config.timeout).toBe(5000);
    expect(config.retryAttempts).toBe(3);
  });
});

describe('Error classes', () => {
  it('should create UsageFetchError with correct properties', () => {
    const error = new UsageFetchError('fetch failed', 'FETCH_ERR', true);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(UsageFetchError);
    expect(error.message).toBe('fetch failed');
    expect(error.code).toBe('FETCH_ERR');
    expect(error.retryable).toBe(true);
    expect(error.name).toBe('UsageFetchError');
  });

  it('should default retryable to false', () => {
    const error = new UsageFetchError('fail', 'ERR');
    expect(error.retryable).toBe(false);
  });

  it('should create SyncError with correct properties', () => {
    const error = new SyncError('sync failed', 'SYNC_ERR');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SyncError);
    expect(error.message).toBe('sync failed');
    expect(error.code).toBe('SYNC_ERR');
    expect(error.name).toBe('SyncError');
  });

  it('should create AuthError with correct properties', () => {
    const error = new AuthError('auth failed', 'AUTH_ERR');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.message).toBe('auth failed');
    expect(error.code).toBe('AUTH_ERR');
    expect(error.name).toBe('AuthError');
  });
});

describe('calculateUsagePercentages', () => {
  it('returns correct percentages for valid usage data', () => {
    const data = createValidUsageData({ tokensUsed: 7500, tokensLimit: 10000, messagesUsed: 30, messagesLimit: 100 });
    const result = calculateUsagePercentages(data);
    expect(result.tokensPercentage).toBe(75);
    expect(result.messagesPercentage).toBe(30);
  });

  it('returns 0 when limits are zero', () => {
    const data = createValidUsageData({ tokensLimit: 0, messagesLimit: 0 });
    const result = calculateUsagePercentages(data);
    expect(result.tokensPercentage).toBe(0);
    expect(result.messagesPercentage).toBe(0);
  });

  it('handles 100% usage', () => {
    const data = createValidUsageData({ tokensUsed: 10000, tokensLimit: 10000, messagesUsed: 100, messagesLimit: 100 });
    const result = calculateUsagePercentages(data);
    expect(result.tokensPercentage).toBe(100);
    expect(result.messagesPercentage).toBe(100);
  });

  it('handles usage exceeding limit', () => {
    const data = createValidUsageData({ tokensUsed: 15000, tokensLimit: 10000 });
    const result = calculateUsagePercentages(data);
    expect(result.tokensPercentage).toBe(150);
  });
});

describe('determineThreshold', () => {
  it("returns 'critical' when percentage >= 90", () => {
    expect(determineThreshold(90)).toBe('critical');
    expect(determineThreshold(95)).toBe('critical');
    expect(determineThreshold(100)).toBe('critical');
  });

  it("returns 'high' when percentage >= 75 and < 90", () => {
    expect(determineThreshold(75)).toBe('high');
    expect(determineThreshold(89)).toBe('high');
  });

  it("returns 'medium' when percentage >= 50 and < 75", () => {
    expect(determineThreshold(50)).toBe('medium');
    expect(determineThreshold(74)).toBe('medium');
  });

  it("returns 'low' when percentage < 50", () => {
    expect(determineThreshold(0)).toBe('low');
    expect(determineThreshold(49)).toBe('low');
  });
});

describe('validateUsageData', () => {
  it('returns true for valid usage data', () => {
    expect(validateUsageData(createValidUsageData())).toBe(true);
  });

  it('returns false for null', () => {
    expect(validateUsageData(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(validateUsageData('string')).toBe(false);
    expect(validateUsageData(42)).toBe(false);
  });

  it('returns false for negative values', () => {
    expect(validateUsageData(createValidUsageData({ tokensUsed: -1 }))).toBe(false);
    expect(validateUsageData(createValidUsageData({ tokensLimit: -1 }))).toBe(false);
    expect(validateUsageData(createValidUsageData({ messagesUsed: -1 }))).toBe(false);
    expect(validateUsageData(createValidUsageData({ messagesLimit: -1 }))).toBe(false);
  });

  it('returns false for missing required fields', () => {
    expect(validateUsageData({ tokensUsed: 100 })).toBe(false);
    expect(validateUsageData({})).toBe(false);
  });

  it('returns false for invalid date objects', () => {
    expect(validateUsageData(createValidUsageData({ resetTime: new Date('invalid') }))).toBe(false);
    expect(validateUsageData(createValidUsageData({ lastUpdated: new Date('invalid') }))).toBe(false);
  });
});
