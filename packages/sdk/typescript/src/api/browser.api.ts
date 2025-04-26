import type { AxiosInstance } from 'axios';
import { Client } from './http-client.ts';
import type {
  CreateContextParams,
  CreateContextResult,
  CreatePageParams,
  CreatePageResult,
  GetPageResult,
  ListPagesResult,
  VisionClickParams,
  VisionClickResult,
  VisionDoubleClickParams,
  VisionDoubleClickResult,
  VisionDragParams,
  VisionDragResult,
  VisionKeyPressParams,
  VisionKeyPressResult,
  VisionMoveParams,
  VisionMoveResult,
  VisionScreenshotParams,
  VisionScreenshotResult,
  VisionScrollParams,
  VisionScrollResult,
  VisionTypeParams,
  VisionTypeResult,
} from '../types/browser.ts';

const API_PREFIX = '/api/v1';

export class BrowserApi extends Client {
  /**
   * Creates a browser context.
   * POST /api/v1/boxes/{id}/browser-contexts
   */
  async createContext(
    boxId: string,
    params: CreateContextParams,
    signal?: AbortSignal
  ): Promise<CreateContextResult> {
    return await super.post<CreateContextResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts`,
      params,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Closes a browser context.
   * DELETE /api/v1/boxes/{id}/browser-contexts/{context_id}
   */
  async closeContext(
    boxId: string,
    contextId: string,
    signal?: AbortSignal
  ): Promise<void> {
    return await super.delete(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}`,
      undefined,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Creates a new page and navigates to URL.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages
   */
  async createPage(
    boxId: string,
    contextId: string,
    params: CreatePageParams,
    signal?: AbortSignal
  ): Promise<CreatePageResult> {
    return await super.post<CreatePageResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages`,
      params,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Lists all pages in a context.
   * GET /api/v1/boxes/{id}/browser-contexts/{context_id}/pages
   */
  async listPages(
    boxId: string,
    contextId: string,
    signal?: AbortSignal
  ): Promise<ListPagesResult> {
    return await super.get<ListPagesResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages`,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Closes a page.
   * DELETE /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}
   */
  async closePage(
    boxId: string,
    contextId: string,
    pageId: string,
    signal?: AbortSignal
  ): Promise<void> {
    return await super.delete(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}`,
      undefined,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Gets page details, optionally including content.
   * GET /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}
   */
  async getPage(
    boxId: string,
    contextId: string,
    pageId: string,
    withContent: boolean = false,
    contentType: 'html' | 'markdown' = 'html',
    signal?: AbortSignal
  ): Promise<GetPageResult> {
    const params = {
      withContent: withContent.toString(),
      contentType,
    };
    return await super.get<GetPageResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}`,
      params,
      undefined,
      signal
    );
  }

  // --- Vision Action APIs ---

  /**
   * Executes a click action.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}/actions/vision-click
   */
  async visionClick(
    boxId: string,
    contextId: string,
    pageId: string,
    params: VisionClickParams,
    signal?: AbortSignal
  ): Promise<VisionClickResult> {
    return await super.post<VisionClickResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-click`,
      params,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Executes a double click action.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}/actions/vision-doubleClick
   */
  async visionDoubleClick(
    boxId: string,
    contextId: string,
    pageId: string,
    params: VisionDoubleClickParams,
    signal?: AbortSignal
  ): Promise<VisionDoubleClickResult> {
    return await super.post<VisionDoubleClickResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-doubleClick`,
      params,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Executes a type action.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}/actions/vision-type
   */
  async visionType(
    boxId: string,
    contextId: string,
    pageId: string,
    params: VisionTypeParams,
    signal?: AbortSignal
  ): Promise<VisionTypeResult> {
    return await super.post<VisionTypeResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-type`,
      params,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Executes a drag action.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}/actions/vision-drag
   */
  async visionDrag(
    boxId: string,
    contextId: string,
    pageId: string,
    params: VisionDragParams,
    signal?: AbortSignal
  ): Promise<VisionDragResult> {
    return await super.post<VisionDragResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-drag`,
      params,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Executes a keyPress action.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}/actions/vision-keyPress
   */
  async visionKeyPress(
    boxId: string,
    contextId: string,
    pageId: string,
    params: VisionKeyPressParams,
    signal?: AbortSignal
  ): Promise<VisionKeyPressResult> {
    return await super.post<VisionKeyPressResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-keyPress`,
      params,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Executes a mouse move action.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}/actions/vision-move
   */
  async visionMove(
    boxId: string,
    contextId: string,
    pageId: string,
    params: VisionMoveParams,
    signal?: AbortSignal
  ): Promise<VisionMoveResult> {
    return await super.post<VisionMoveResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-move`,
      params,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Executes a screenshot action.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}/actions/vision-screenshot
   */
  async visionScreenshot(
    boxId: string,
    contextId: string,
    pageId: string,
    params: VisionScreenshotParams,
    signal?: AbortSignal
  ): Promise<VisionScreenshotResult> {
    return await super.post<VisionScreenshotResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-screenshot`,
      params,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Executes a scroll action.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}/actions/vision-scroll
   */
  async visionScroll(
    boxId: string,
    contextId: string,
    pageId: string,
    params: VisionScrollParams,
    signal?: AbortSignal
  ): Promise<VisionScrollResult> {
    return await super.post<VisionScrollResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-scroll`,
      params,
      undefined,
      undefined,
      signal
    );
  }
}
