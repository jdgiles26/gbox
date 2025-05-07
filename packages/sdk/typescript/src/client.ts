import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT } from './config.ts';
import type { GBoxClientConfig } from './config.ts'; // Logger type import removed
import { BoxManager } from './managers/box.manager.ts';
import { FileManager } from './managers/file.manager.ts';
import { BoxApi } from './api/box.api.ts';
import { FileApi } from './api/file.api.ts';
import { BrowserApi } from './api/browser.api.ts';
import { Logger } from './logger.ts';

export class GBoxClient {
  private readonly httpClient: AxiosInstance;
  private readonly boxApi: BoxApi;
  private readonly fileApi: FileApi;
  private readonly browserApi: BrowserApi;
  readonly boxes: BoxManager;
  readonly files: FileManager;
  readonly config: GBoxClientConfig;
  // readonly logger: Logger; // logger instance variable removed

  constructor(config: GBoxClientConfig = {}) {
    this.config = config;

    if (config.logLevel !== undefined) {
      Logger.setGlobalLogLevel(config.logLevel); // Use SdkLogger directly
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
