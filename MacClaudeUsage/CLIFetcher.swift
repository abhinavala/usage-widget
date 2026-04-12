import { UsageData } from '../src/types/usage';
import { UsageFetcher, FetcherConfig } from '../src/types/fetcher';
import { executeCLICommand, validateCLIToolsAvailable, FetchError } from './CLICommandRunner.swift';
import { parseCLIOutput } from './CLIOutputParser.swift';

const DEFAULT_CLI_CONFIG: FetcherConfig = {
  type: 'cli',
  timeout: 30000,
  retryAttempts: 2,
};

export class CLIFetcher implements UsageFetcher {
  private config: FetcherConfig;
  private apiEndpoint: string;
  private cookiePath: string;

  constructor(
    config: Partial<FetcherConfig> = {},
    apiEndpoint: string = 'https://api.claude.ai/api/usage',
    cookiePath: string = `${process.env.HOME}/.claude/cookies.json`,
  ) {
    this.config = { ...DEFAULT_CLI_CONFIG, ...config, type: 'cli' };
    this.apiEndpoint = apiEndpoint;
    this.cookiePath = cookiePath;
  }

  async fetchUsage(): Promise<UsageData> {
    const toolsAvailable = await validateCLIToolsAvailable();
    if (!toolsAvailable) {
      throw new FetchError(
        'Required CLI tools are not available',
        'TOOLS_UNAVAILABLE',
        'cli',
        false,
      );
    }

    let lastError: FetchError | undefined;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.attemptFetch();
      } catch (error) {
        if (error instanceof FetchError) {
          lastError = error;
          if (!error.retryable || attempt === this.config.retryAttempts) {
            throw error;
          }
          await this.delay(Math.pow(2, attempt) * 1000);
        } else {
          throw new FetchError(
            `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
            'UNEXPECTED_ERROR',
            'cli',
            false,
          );
        }
      }
    }

    throw lastError ?? new FetchError('All retry attempts exhausted', 'RETRIES_EXHAUSTED', 'cli', false);
  }

  private async attemptFetch(): Promise<UsageData> {
    const args = [
      '-s',
      '-S',
      '--max-time', String(Math.floor(this.config.timeout / 1000)),
      '-b', this.cookiePath,
      '-H', 'Accept: application/json',
      this.apiEndpoint,
    ];

    const result = await executeCLICommand('curl', args, this.config.timeout);

    if (result.exitCode !== 0) {
      throw new FetchError(
        `curl exited with code ${result.exitCode}: ${result.stderr}`,
        'CURL_FAILED',
        'cli',
        true,
      );
    }

    return parseCLIOutput(result.stdout);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { FetchError } from './CLICommandRunner.swift';
export { parseCLIOutput, mapToUsageData } from './CLIOutputParser.swift';
export { executeCLICommand, validateCLIToolsAvailable } from './CLICommandRunner.swift';
