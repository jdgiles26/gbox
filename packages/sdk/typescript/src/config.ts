// Define a basic logger interface (can be expanded)
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export const DEFAULT_BASE_URL = 'http://localhost:28080';
export const DEFAULT_TIMEOUT = 60000; // 60 seconds in milliseconds

export interface GBoxClientConfig {
  baseURL?: string;
  timeout?: number;
  logger?: Logger;
  // Add other configuration options as needed, e.g., custom logger, headers
}
