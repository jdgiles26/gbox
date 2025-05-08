import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT } from './config.ts';
import type { GBoxClientConfig } from './config.ts';
import { BoxManager } from './managers/box.manager.ts';
import { FileManager } from './managers/file.manager.ts';
import { BoxApi } from './api/box.api.ts';
import { FileApi } from './api/file.api.ts';
import { BrowserApi } from './api/browser.api.ts';
import { setLoggerTransports, setLoggerLevel } from './logger.ts';

export class GBoxClient {
  private readonly httpClient: AxiosInstance;
  private readonly boxApi: BoxApi;
  private readonly fileApi: FileApi;
  private readonly browserApi: BrowserApi;
  readonly boxes: BoxManager;
  readonly files: FileManager;
  readonly config: GBoxClientConfig;

  constructor(config: GBoxClientConfig = {}) {
    this.config = config;

    // Configure logger if logger config is provided
    if (config.logger) {
      // Configure logger level if provided
      if (config.logger.level) {
        setLoggerLevel(config.logger.level);
      }

      // Configure logger transports if provided
      if (config.logger.transports && config.logger.transports.length > 0) {
        setLoggerTransports(config.logger.transports);
      }
    }

    const baseURL = config.baseURL || DEFAULT_BASE_URL;
    const timeout = config.timeout || DEFAULT_TIMEOUT;

    this.httpClient = axios.create({
      baseURL,
      timeout,
    });

    this.boxApi = new BoxApi(this.httpClient);
    this.fileApi = new FileApi(this.httpClient);
    this.browserApi = new BrowserApi(this.httpClient);

    this.boxes = new BoxManager(this.boxApi, this.browserApi);
    this.files = new FileManager(this.fileApi);
  }
}
