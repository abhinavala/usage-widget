export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export class ErrorLogger {
  private logs: LogEntry[] = [];
  private maxLogSize: number;

  constructor(maxLogSize: number = 1000) {
    this.maxLogSize = maxLogSize;
  }

  log(level: LogLevel, category: string, message: string, context?: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      context,
      metadata,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }
  }

  debug(category: string, message: string, context?: string): void {
    this.log('debug', category, message, context);
  }

  info(category: string, message: string, context?: string): void {
    this.log('info', category, message, context);
  }

  warning(category: string, message: string, context?: string): void {
    this.log('warning', category, message, context);
  }

  error(category: string, message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log('error', category, message, context, metadata);
  }

  critical(category: string, message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.log('critical', category, message, context, metadata);
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((entry) => entry.level === level);
  }

  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter((entry) => entry.category === category);
  }

  clearLogs(): void {
    this.logs = [];
  }
}
