import { describe, it, expect } from 'vitest';
import { UsageData, UsagePercentages, UsageThreshold } from '../../types/usage';
import { UsageFetcher, FetcherType, FetcherConfig } from '../../types/fetcher';
import { UsageFetchError, SyncError, AuthError } from '../../types/errors';
import { calculateUsagePercentages, determineThreshold } from '../../utils/usageCalculations';
import { validateUsageData } from '../../utils/validation';

describe('UsageData types', () => {
  const validUsageData: UsageData = {
    tokensUsed: 5000,
    tokensLimit: 10000,
    messagesUsed: 25,
    messagesLimit: 100,
    resetTime: new Date('2026-04-12T00:00:00Z'),
    lastUpdated: new Date('2026-04-11T12:00:00Z'),
  };

  describe('calculateUsagePercentages', () => {
    it('returns correct percentages for valid usage data', () => {
      const result = calculateUsagePercentages(validUsageData);
      expect(result.tokensPercentage).toBe(50);
      expect(result.messagesPercentage).toBe(25);
    });

    it('handles zero limits without division errors', () => {
      const zeroLimits: UsageData = {
        ...validUsageData,
        tokensLimit: 0,
        messagesLimit: 0,
      };
      const result = calculateUsagePercentages(zeroLimits);
      expect(result.tokensPercentage).toBe(0);
      expect(result.messagesPercentage).toBe(0);
    });

    it('handles 100% usage correctly', () => {
      const fullUsage: UsageData = {
        ...validUsageData,
        tokensUsed: 10000,
        messagesUsed: 100,
      };
      const result = calculateUsagePercentages(fullUsage);
      expect(result.tokensPercentage).toBe(100);
      expect(result.messagesPercentage).toBe(100);
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
    it('accepts valid usage data', () => {
      expect(validateUsageData(validUsageData)).toBe(true);
    });

    it('rejects null and undefined', () => {
      expect(validateUsageData(null)).toBe(false);
      expect(validateUsageData(undefined)).toBe(false);
    });

    it('rejects non-object values', () => {
      expect(validateUsageData('string')).toBe(false);
      expect(validateUsageData(42)).toBe(false);
    });

    it('rejects negative numeric values', () => {
      expect(validateUsageData({ ...validUsageData, tokensUsed: -1 })).toBe(false);
      expect(validateUsageData({ ...validUsageData, tokensLimit: -5 })).toBe(false);
      expect(validateUsageData({ ...validUsageData, messagesUsed: -1 })).toBe(false);
      expect(validateUsageData({ ...validUsageData, messagesLimit: -10 })).toBe(false);
    });

    it('rejects missing required fields', () => {
      expect(validateUsageData({ tokensUsed: 100 })).toBe(false);
      expect(validateUsageData({})).toBe(false);
    });

    it('rejects invalid date objects', () => {
      expect(validateUsageData({ ...validUsageData, resetTime: 'not-a-date' })).toBe(false);
      expect(validateUsageData({ ...validUsageData, lastUpdated: new Date('invalid') })).toBe(false);
    });
  });

  describe('Error classes', () => {
    it('UsageFetchError has correct properties', () => {
      const err = new UsageFetchError('fetch failed', 'FETCH_TIMEOUT', true);
      expect(err.message).toBe('fetch failed');
      expect(err.code).toBe('FETCH_TIMEOUT');
      expect(err.retryable).toBe(true);
      expect(err.name).toBe('UsageFetchError');
      expect(err instanceof Error).toBe(true);
    });

    it('UsageFetchError defaults retryable to false', () => {
      const err = new UsageFetchError('fail', 'ERR');
      expect(err.retryable).toBe(false);
    });

    it('SyncError has correct properties', () => {
      const err = new SyncError('sync failed', 'SYNC_CONFLICT');
      expect(err.message).toBe('sync failed');
      expect(err.code).toBe('SYNC_CONFLICT');
      expect(err.name).toBe('SyncError');
      expect(err instanceof Error).toBe(true);
    });

    it('AuthError has correct properties', () => {
      const err = new AuthError('unauthorized', 'AUTH_EXPIRED');
      expect(err.message).toBe('unauthorized');
      expect(err.code).toBe('AUTH_EXPIRED');
      expect(err.name).toBe('AuthError');
      expect(err instanceof Error).toBe(true);
    });
  });
});
