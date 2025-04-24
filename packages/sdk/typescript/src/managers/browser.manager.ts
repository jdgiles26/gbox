import { BrowserApi } from '../api/browser.api.ts';
import { BrowserContext } from '../models/context.ts'; // Import the model
import type { CreateContextParams, CreateContextResult } from '../types/browser.ts';

/**
 * Manages browser contexts within a specific Box.
 * Obtained via `box.getBrowserManager()`.
 */
export class BoxBrowserManager {
  private readonly boxId: string;
  private readonly api: BrowserApi;

  /**
   * Constructs a manager for browser contexts within a specific box.
   * @param boxId The ID of the Box this manager operates on.
   * @param api The BrowserApi instance for making API calls.
   */
  constructor(boxId: string, api: BrowserApi) {
    this.boxId = boxId;
    this.api = api;
  }

  /**
   * Creates a new browser context within the associated Box.
   * @param params Optional parameters for creating the context.
   * @returns A promise that resolves with a new BrowserContext model instance.
   */
  async createContext(params: CreateContextParams = {}): Promise<BrowserContext> {
    const result: { context_id: string } = await this.api.createContext(this.boxId, params) as any;
    return new BrowserContext(result.context_id, this.boxId, this.api);
  }

  /**
   * Closes a specific browser context within the associated Box.
   * @param contextId The ID of the browser context to close.
   * @returns A promise that resolves when the context has been closed.
   */
  async closeContext(contextId: string): Promise<void> {
    await this.api.closeContext(this.boxId, contextId);
  }

  // Potential future methods: listContexts, getContext, etc.
} 