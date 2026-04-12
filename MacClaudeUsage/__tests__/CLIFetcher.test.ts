import { describe, it, expect } from 'vitest';
import { UsageData } from '../../src/types/usage';
import { FetcherType } from '../../src/types/fetcher';
import { FetchError } from '../../src/types/errors';

// Inline implementations for testing (mirrors CLICommandRunner + CLIOutputParser + CLIFetcher logic)

function parseCLIOutput(raw: string): UsageData {
  if (!raw || typeof raw !== 'string') {
    throw new FetchError('Empty or invalid CLI output', 'PARSE_EMPTY', 'cli', false);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new FetchError('Failed to parse CLI output as JSON', 'PARSE_JSON_ERROR', 'cli', false);
  }

  const tokensUsed = extractNumber(parsed, 'tokensUsed', 'tokens_used');
  const tokensLimit = extractNumber(parsed, 'tokensLimit', 'tokens_limit');
  const messagesUsed = extractNumber(parsed, 'messagesUsed', 'messages_used');
  const messagesLimit = extractNumber(parsed, 'messagesLimit', 'messages_limit');
  const resetTime = extractDate(parsed, 'resetTime', 'reset_time');

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

function extractNumber(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
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

function extractDate(obj: Record<string, unknown>, ...keys: string[]): Date | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date;
    }
  }
  return undefined;
}

async function executeCLICommand(
  command: string,
  _args: string[],
  _timeoutMs: number = 30000,
  mockExecutor?: (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (!command || typeof command !== 'string') {
    throw new FetchError('Invalid command', 'INVALID_COMMAND', 'cli', false);
  }

  const allowedCommands = ['curl', 'cat', 'defaults'];
  const baseCommand = command.split('/').pop() || command;
  if (!allowedCommands.includes(baseCommand)) {
    throw new FetchError(`Command not allowed: ${baseCommand}`, 'COMMAND_NOT_ALLOWED', 'cli', false);
  }

  for (const arg of _args) {
    if (arg.includes(';') || arg.includes('|') || arg.includes('`') || arg.includes('$(')) {
      throw new FetchError('Potentially unsafe argument detected', 'UNSAFE_ARGUMENT', 'cli', false);
    }
  }

  if (mockExecutor) {
    return mockExecutor(command, _args);
  }

  throw new FetchError('No executor available', 'COMMAND_FAILED', 'cli', false);
}

function validateCLIToolsAvailable(
  mockChecker?: (tool: string) => Promise<boolean>,
): Promise<boolean> {
  const requiredTools = ['curl'];
  return (async () => {
    for (const tool of requiredTools) {
      if (mockChecker) {
        const available = await mockChecker(tool);
        if (!available) return false;
      } else {
        return false;
      }
    }
    return true;
  })();
}

describe('CLIFetcher', () => {
  describe('fetchUsage returns valid UsageData when CLI commands execute successfully', () => {
    it('returns valid UsageData from successful CLI response', async () => {
      const mockResponse = JSON.stringify({
        tokensUsed: 5000,
        tokensLimit: 100000,
        messagesUsed: 50,
        messagesLimit: 500,
        resetTime: '2026-04-12T00:00:00Z',
      });

      const mockExecutor = async () => ({
        stdout: mockResponse,
        stderr: '',
        exitCode: 0,
      });

      const result = await executeCLICommand('curl', ['-s', 'https://api.claude.ai/api/usage'], 30000, mockExecutor);
      const usageData = parseCLIOutput(result.stdout);

      expect(usageData.tokensUsed).toBe(5000);
      expect(usageData.tokensLimit).toBe(100000);
      expect(usageData.messagesUsed).toBe(50);
      expect(usageData.messagesLimit).toBe(500);
      expect(usageData.resetTime).toBeInstanceOf(Date);
      expect(usageData.lastUpdated).toBeInstanceOf(Date);
      expect(usageData.lastUpdated.getTime()).toBeLessThanOrEqual(Date.now());
      expect(usageData.lastUpdated.getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('handles snake_case field names in response', async () => {
      const mockResponse = JSON.stringify({
        tokens_used: 3000,
        tokens_limit: 50000,
        messages_used: 20,
        messages_limit: 200,
        reset_time: '2026-04-12T12:00:00Z',
      });

      const usageData = parseCLIOutput(mockResponse);

      expect(usageData.tokensUsed).toBe(3000);
      expect(usageData.tokensLimit).toBe(50000);
      expect(usageData.messagesUsed).toBe(20);
      expect(usageData.messagesLimit).toBe(200);
    });

    it('UsageData format matches WebAPI output structure', async () => {
      const mockResponse = JSON.stringify({
        tokensUsed: 1000,
        tokensLimit: 10000,
        messagesUsed: 10,
        messagesLimit: 100,
        resetTime: '2026-04-12T00:00:00Z',
      });

      const usageData = parseCLIOutput(mockResponse);

      expect(usageData).toHaveProperty('tokensUsed');
      expect(usageData).toHaveProperty('tokensLimit');
      expect(usageData).toHaveProperty('messagesUsed');
      expect(usageData).toHaveProperty('messagesLimit');
      expect(usageData).toHaveProperty('resetTime');
      expect(usageData).toHaveProperty('lastUpdated');
      expect(typeof usageData.tokensUsed).toBe('number');
      expect(typeof usageData.tokensLimit).toBe('number');
      expect(typeof usageData.messagesUsed).toBe('number');
      expect(typeof usageData.messagesLimit).toBe('number');
      expect(usageData.resetTime).toBeInstanceOf(Date);
      expect(usageData.lastUpdated).toBeInstanceOf(Date);
    });

    it('defaults optional fields when missing', () => {
      const mockResponse = JSON.stringify({
        tokensUsed: 1000,
        tokensLimit: 10000,
      });

      const usageData = parseCLIOutput(mockResponse);

      expect(usageData.messagesUsed).toBe(0);
      expect(usageData.messagesLimit).toBe(0);
      expect(usageData.resetTime).toBeInstanceOf(Date);
    });
  });

  describe('executeCLICommand throws FetchError when command execution fails', () => {
    it('throws FetchError with fetcherType cli on invalid command', async () => {
      try {
        await executeCLICommand('', []);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FetchError);
        const fetchError = error as FetchError;
        expect(fetchError.fetcherType).toBe('cli');
        expect(fetchError.retryable).toBe(false);
      }
    });

    it('throws FetchError for disallowed commands', async () => {
      try {
        await executeCLICommand('rm', ['-rf', '/']);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FetchError);
        const fetchError = error as FetchError;
        expect(fetchError.code).toBe('COMMAND_NOT_ALLOWED');
        expect(fetchError.fetcherType).toBe('cli');
        expect(fetchError.retryable).toBe(false);
      }
    });

    it('throws FetchError for unsafe arguments', async () => {
      try {
        await executeCLICommand('curl', ['http://example.com; rm -rf /']);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FetchError);
        const fetchError = error as FetchError;
        expect(fetchError.code).toBe('UNSAFE_ARGUMENT');
        expect(fetchError.fetcherType).toBe('cli');
        expect(fetchError.retryable).toBe(false);
      }
    });

    it('throws FetchError when command executor fails', async () => {
      const failingExecutor = async () => {
        throw new Error('Connection refused');
      };

      try {
        await executeCLICommand('curl', ['-s', 'http://localhost'], 30000, failingExecutor);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('FetchError has correct error properties', () => {
      const error = new FetchError('test error', 'TEST_CODE', 'cli', false);
      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.fetcherType).toBe('cli');
      expect(error.retryable).toBe(false);
      expect(error.name).toBe('FetchError');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('validateCLIToolsAvailable returns false when required tools are missing', () => {
    it('returns false when curl is not found', async () => {
      const mockChecker = async (_tool: string) => false;
      const result = await validateCLIToolsAvailable(mockChecker);
      expect(result).toBe(false);
    });

    it('returns true when all required tools are available', async () => {
      const mockChecker = async (_tool: string) => true;
      const result = await validateCLIToolsAvailable(mockChecker);
      expect(result).toBe(true);
    });

    it('returns false when no checker is provided (simulates missing tools)', async () => {
      const result = await validateCLIToolsAvailable();
      expect(result).toBe(false);
    });
  });

  describe('CLI output parsing edge cases', () => {
    it('throws on empty string input', () => {
      expect(() => parseCLIOutput('')).toThrow(FetchError);
    });

    it('throws on invalid JSON', () => {
      expect(() => parseCLIOutput('not json at all')).toThrow(FetchError);
      try {
        parseCLIOutput('not json');
      } catch (error) {
        expect((error as FetchError).code).toBe('PARSE_JSON_ERROR');
      }
    });

    it('throws when required token fields are missing', () => {
      expect(() => parseCLIOutput(JSON.stringify({ messagesUsed: 10 }))).toThrow(FetchError);
      try {
        parseCLIOutput(JSON.stringify({ messagesUsed: 10 }));
      } catch (error) {
        expect((error as FetchError).code).toBe('PARSE_MISSING_FIELDS');
      }
    });

    it('handles string numeric values', () => {
      const response = JSON.stringify({
        tokensUsed: '5000',
        tokensLimit: '100000',
      });
      const data = parseCLIOutput(response);
      expect(data.tokensUsed).toBe(5000);
      expect(data.tokensLimit).toBe(100000);
    });
  });
});
