import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT } from './config.ts';
import type { GBoxClientConfig, Logger } from './config.ts';
import { BoxManager } from './managers/box.manager.ts';
import { FileManager } from './managers/file.manager.ts';
import { Client as ApiClient } from './api/http-client.ts';
import { BoxApi } from './api/box.api.ts';
import { FileApi } from './api/file.api.ts';
import { BrowserApi } from './api/browser.api.ts';

export class GBoxClient {
  private readonly httpClient: AxiosInstance;
  private readonly apiClient: ApiClient;
  private readonly boxApi: BoxApi;
  private readonly fileApi: FileApi;
  private readonly browserApi: BrowserApi;
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
    this.browserApi = new BrowserApi(this.httpClient, useLogger);

    this.boxes = new BoxManager(this.boxApi, this.browserApi);
    this.files = new FileManager(this.fileApi);

    // TODO: Add error handling interceptors for httpClient
  }

  // Add any client-level methods if necessary
} 