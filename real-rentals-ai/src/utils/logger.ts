/**
 * Sistema de logging estructurado
 * En producción, se puede integrar con servicios como Winston, Pino, etc.
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: Error;
}

class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLog(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      entry.context ? `[${entry.context}]` : '',
      entry.message,
    ].filter(Boolean);

    let logMessage = parts.join(' ');

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      logMessage += ` | Metadata: ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      logMessage += ` | Error: ${entry.error.message}`;
      if (entry.error.stack) {
        logMessage += ` | Stack: ${entry.error.stack}`;
      }
    }

    return logMessage;
  }

  private log(level: LogLevel, message: string, context?: string, metadata?: Record<string, any>, error?: Error) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      context,
      metadata,
      error,
    };

    const formatted = this.formatLog(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV !== 'production') {
          console.debug(formatted);
        }
        break;
    }
  }

  error(message: string, context?: string, error?: Error, metadata?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, context, metadata, error);
  }

  warn(message: string, context?: string, metadata?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  info(message: string, context?: string, metadata?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  debug(message: string, context?: string, metadata?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }
}

export const logger = new Logger();

