type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

class Logger {
  private isDev: boolean;

  constructor(isDev: boolean = process.env.NODE_ENV === 'development') {
    this.isDev = isDev;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
    };

    if (this.isDev || level === 'error') {
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    const data = error instanceof Error ? { error: error.message } : error;
    this.log('error', message, data);
  }
}

export const logger = new Logger();
