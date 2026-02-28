/**
 * Simple leveled logger with fixed mod prefix.
 */
import { MOD_NAME } from './constants.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export class Logger {
  private readonly scope: string;
  private level: LogLevel;

  constructor(scope: string, level: LogLevel = LogLevel.INFO) {
    this.scope = Logger.normalizeScope(scope);
    this.level = level;
  }

  private static normalizeScope(scope: string): string {
    const trimmed = scope.trim();
    if (!trimmed || trimmed === MOD_NAME) return '';
    return trimmed;
  }

  private get fullPrefix(): string {
    return this.scope ? `${MOD_NAME}/${this.scope}` : MOD_NAME;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[${this.fullPrefix}]`, ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${this.fullPrefix}]`, ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${this.fullPrefix}]`, ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${this.fullPrefix}]`, ...args);
    }
  }

  /** Create a child logger with a sub-prefix */
  child(subPrefix: string): Logger {
    const subScope = Logger.normalizeScope(subPrefix);
    const nextScope = this.scope
      ? (subScope ? `${this.scope}/${subScope}` : this.scope)
      : subScope;
    return new Logger(nextScope, this.level);
  }
}
