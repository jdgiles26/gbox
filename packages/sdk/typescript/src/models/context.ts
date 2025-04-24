import { BrowserApi } from '../api/browser.api.ts';
import { BrowserPage } from './page.ts'; // Assuming BrowserPage model exists
import type { CreatePageParams, ListPagesResult } from '../types/browser.ts';

/**
 * Represents a browser context within a Box.
 * Manages the lifecycle of BrowserPage instances within this context.
 */
export class BrowserContext {
  public readonly id: string;
  public readonly boxId: string;
  private readonly api: BrowserApi; // Holds the reference to the BrowserApi client

  /**
   * Constructs a new BrowserContext instance.
   * Typically created via Box.createBrowserContext().
   * @param id - The unique identifier of the browser context.
   * @param boxId - The identifier of the Box containing this context.
   * @param api - The BrowserApi instance for making API calls.
   */
  constructor(id: string, boxId: string, api: BrowserApi) {
    this.id = id;
    this.boxId = boxId;
    this.api = api;
  }

  /**
   * Creates a new browser page within this context and navigates to the specified URL.
   * @param params - Parameters for creating the page, including the URL.
   * @returns A promise that resolves with a new BrowserPage instance.
   */
  async createPage(params: CreatePageParams): Promise<BrowserPage> {
    // Ensure the result type matches the actual API response (even if SDK type uses camelCase)
    const result: { page_id: string; url: string; title: string } = await this.api.createPage(this.boxId, this.id, params) as any;
    // Instantiate and return a BrowserPage model using the correct field 'page_id'
    return new BrowserPage(result.page_id, this.id, this.boxId, this.api);
  }

  /**
   * Lists all pages currently open within this browser context.
   * @returns A promise that resolves with an array of BrowserPage instances.
   */
  async listPages(): Promise<BrowserPage[]> {
    const result = await this.api.listPages(this.boxId, this.id);
    // Map the API result to BrowserPage model instances
    return result.pages.map(pageInfo => new BrowserPage(pageInfo.pageId, this.id, this.boxId, this.api));
  }

  /**
   * Gets a local BrowserPage model instance representing a page within this context.
   * Note: This method does not verify if the page actually exists on the server.
   * It's used to get a handle to an existing page for performing actions.
   * @param pageId - The ID of the page to get a handle for.
   * @returns A BrowserPage instance.
   */
   getPage(pageId: string): BrowserPage {
    // Return a new BrowserPage instance, assuming it exists for subsequent operations.
    return new BrowserPage(pageId, this.id, this.boxId, this.api);
   }
} 