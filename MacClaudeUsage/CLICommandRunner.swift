import { FetcherType } from '../.worktrees/cmnuzrzro005l11bqxcqtgn4v/src/types/fetcher';

export class FetchError extends Error {
  code: string;
  fetcherType: FetcherType;
  retryable: boolean;

  constructor(message: string, code: string, fetcherType: FetcherType, retryable: boolean = false) {
    super(message);
    this.name = 'FetchError';
    this.code = code;
    this.fetcherType = fetcherType;
    this.retryable = retryable;
  }
}

export interface CLICommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function executeCLICommand(command: string, args: string[], timeoutMs: number = 30000): Promise<CLICommandResult> {
  if (!command || typeof command !== 'string') {
    throw new FetchError('Invalid command', 'INVALID_COMMAND', 'cli', false);
  }

  const allowedCommands = ['curl', 'cat', 'defaults'];
  const baseCommand = command.split('/').pop() || command;
  if (!allowedCommands.includes(baseCommand)) {
    throw new FetchError(
      `Command not allowed: ${baseCommand}`,
      'COMMAND_NOT_ALLOWED',
      'cli',
      false,
    );
  }

  for (const arg of args) {
    if (typeof arg !== 'string') {
      throw new FetchError('Invalid argument type', 'INVALID_ARGUMENT', 'cli', false);
    }
    if (arg.includes(';') || arg.includes('|') || arg.includes('`') || arg.includes('$(')) {
      throw new FetchError(
        'Potentially unsafe argument detected',
        'UNSAFE_ARGUMENT',
        'cli',
        false,
      );
    }
  }

  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { code?: string; killed?: boolean; stderr?: string };
    if (err.killed || err.code === 'ETIMEDOUT') {
      throw new FetchError(
        'CLI command timed out',
        'COMMAND_TIMEOUT',
        'cli',
        true,
      );
    }
    throw new FetchError(
      `CLI command failed: ${err.stderr || 'unknown error'}`,
      'COMMAND_FAILED',
      'cli',
      false,
    );
  }
}

export async function validateCLIToolsAvailable(): Promise<boolean> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  const requiredTools = ['curl'];

  for (const tool of requiredTools) {
    try {
      await execFileAsync('which', [tool], { timeout: 5000 });
    } catch {
      return false;
    }
  }
  return true;
}
