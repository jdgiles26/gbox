import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT } from './config.ts';
import type { GBoxClientConfig, Logger } from './config.ts';
import { BoxManager } from './managers/boxManager.ts';
import { FileManager } from './managers/fileManager.ts';
import { Client as ApiClient } from './api/client.ts';
import { BoxApi } from './api/boxApi.ts';
import { FileApi } from './api/fileApi.ts';

export class GBoxClient {
  private readonly httpClient: AxiosInstance;
  private readonly apiClient: ApiClient;
  private readonly boxApi: BoxApi;
  private readonly fileApi: FileApi;
  readonly boxes: BoxManager;
  readonly files: FileManager;
  readonly config: GBoxClientConfig;
  readonly logger: Logger;

  constructor(config: GBoxClientConfig = {}) {
    this.config = config;
    const baseURL = config.baseURL || DEFAULT_BASE_URL;
    const timeout = config.timeout || DEFAULT_TIMEOUT;
    const useLogger = config.logger === false ? false : (config.logger || undefined);

    this.httpClient = axios.create({
      baseURL,
      timeout,
    });

    this.apiClient = new ApiClient(this.httpClient, useLogger);
    this.logger = this.apiClient['logger'];

    this.boxApi = new BoxApi(this.httpClient, useLogger);
    this.fileApi = new FileApi(this.httpClient, useLogger);

    this.boxes = new BoxManager(this.boxApi);
    this.files = new FileManager(this.fileApi);

    // TODO: Add error handling interceptors for httpClient
  }

  // Add any client-level methods if necessary
} 