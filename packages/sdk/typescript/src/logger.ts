export enum LogLevel {
  NONE,  // 0
  ERROR, // 1
  WARN,  // 2
  INFO,  // 3
  DEBUG, // 4
}

export class Logger {
  public static Level = LogLevel;
  private static globalLogLevel: LogLevel = LogLevel.INFO;

  private instanceLogLevel?: LogLevel;
  private _name?: string;

  constructor(name?: string) {
    this._name = name;
  }

  // Helper to compare log levels
  private getLevelValue(level: LogLevel): number {
    return level as number;
  }

  private getLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.ERROR:
        return 'ERROR';
      case LogLevel.NONE:
        return 'NONE';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Sets the global log level for all Logger instances that do not have an instance-specific level set.
   * @param level The desired global log level.
   */
  public static setGlobalLogLevel(level: LogLevel): void {
    Logger.globalLogLevel = level;
  }

  /**
   * Gets the current global log level.
   * @returns The current global log level.
   */
  public static getGlobalLogLevel(): LogLevel {
    return Logger.globalLogLevel;
  }

  /**
   * Sets the log level for this specific Logger instance.
   * This will override the global log level for this instance.
   * @param level The desired log level for this instance.
   */
  public setLogLevel(level: LogLevel): void {
    this.instanceLogLevel = level;
  }

  /**
   * Clears the instance-specific log level for this Logger.
   * After calling this, the instance will use the global log level.
   */
  public clearLogLevel(): void {
    this.instanceLogLevel = undefined;
  }

  /**
   * Gets the effective log level for this Logger instance.
   * It returns the instance-specific log level if set, otherwise falls back to the global log level.
   * @returns The effective log level.
   */
  public getLogLevel(): LogLevel {
    return this.instanceLogLevel ?? Logger.globalLogLevel;
  }

  private log(level: LogLevel, consoleMethod: (...args: any[]) => void, ...args: any[]): void {
    const effectiveLevel = this.getLogLevel();
    if (this.getLevelValue(effectiveLevel) >= this.getLevelValue(level)) {
      const timestamp = new Date().toISOString();
      const levelString = this.getLevelString(level);
      consoleMethod(`[${timestamp}] [${levelString}]`, ...args);
    }
  }

  public debug(...args: any[]): Logger {
    this.log(LogLevel.DEBUG, console.debug, ...args);
    return this;
  }

  public info(...args: any[]): Logger {
    this.log(LogLevel.INFO, console.info, ...args);
    return this;
  }

  public warn(...args: any[]): Logger {
    this.log(LogLevel.WARN, console.warn, ...args);
    return this;
  }

  public error(...args: any[]): Logger {
    this.log(LogLevel.ERROR, console.error, ...args);
    return this;
  }
} 