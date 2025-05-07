import { LogLevel } from './logger.ts';

export const DEFAULT_BASE_URL = 'http://localhost:28080';
export const DEFAULT_TIMEOUT = 60000; // 60 seconds in milliseconds

export interface GBoxClientConfig {
  baseURL?: string;
  timeout?: number;
  logLevel?: LogLevel; // Keep logLevel for global setting
}
