import winston from 'winston';

export const DEFAULT_BASE_URL = 'http://localhost:28080';
export const DEFAULT_TIMEOUT = 60000; // 60 seconds in milliseconds

export interface GBoxClientConfig {
  baseURL?: string;
  timeout?: number;
  logger?: { // Group logger configurations
    transports?: winston.transport[];
    level?: string;
  };
}
