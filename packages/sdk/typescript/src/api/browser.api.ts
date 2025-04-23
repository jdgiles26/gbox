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
  VisionTypeResult
} from '../types/browser.ts';

const API_PREFIX = '/api/v1';

export class BrowserApi extends Client {
  
  /**
   * Creates a browser context.
   * POST /api/v1/boxes/{id}/browser-contexts
   */
  async createContext(boxId: string, params: CreateContextParams): Promise<CreateContextResult> {
    return super.post<CreateContextResult>(`${API_PREFIX}/boxes/${boxId}/browser-contexts`, params);
  }

  /**
   * Closes a browser context.
   * DELETE /api/v1/boxes/{id}/browser-contexts/{context_id}
   */
  async closeContext(boxId: string, contextId: string): Promise<void> {
    return super.delete(`${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}`);
  }

  /**
   * Creates a new page and navigates to URL.
   * POST /api/v1/boxes/{id}/browser-contexts/{context_id}/pages
   */
  async createPage(boxId: string, contextId: string, params: CreatePageParams): Promise<CreatePageResult> {
    return super.post<CreatePageResult>(`${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages`, params);
  }

  /**
   * Lists all pages in a context.
   * GET /api/v1/boxes/{id}/browser-contexts/{context_id}/pages
   */
  async listPages(boxId: string, contextId: string): Promise<ListPagesResult> {
    return super.get<ListPagesResult>(`${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages`);
  }

  /**
   * Closes a page.
   * DELETE /api/v1/boxes/{id}/browser-contexts/{context_id}/pages/{page_id}
   */
  async closePage(boxId: string, contextId: string, pageId: string): Promise<void> {
    return super.delete(`${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}`);
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
    contentType: 'html' | 'markdown' = 'html'
  ): Promise<GetPageResult> {
    const params = {
      withContent: withContent.toString(),
      contentType
    };
    return super.get<GetPageResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}`,
      params
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
    params: VisionClickParams
  ): Promise<VisionClickResult> {
    return super.post<VisionClickResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-click`,
      params
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
    params: VisionDoubleClickParams
  ): Promise<VisionDoubleClickResult> {
    return super.post<VisionDoubleClickResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-doubleClick`,
      params
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
    params: VisionTypeParams
  ): Promise<VisionTypeResult> {
    return super.post<VisionTypeResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-type`,
      params
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
    params: VisionDragParams
  ): Promise<VisionDragResult> {
    return super.post<VisionDragResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-drag`,
      params
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
    params: VisionKeyPressParams
  ): Promise<VisionKeyPressResult> {
    return super.post<VisionKeyPressResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-keyPress`,
      params
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
    params: VisionMoveParams
  ): Promise<VisionMoveResult> {
    return super.post<VisionMoveResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-move`,
      params
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
    params: VisionScreenshotParams
  ): Promise<VisionScreenshotResult> {
    return super.post<VisionScreenshotResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-screenshot`,
      params
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
    params: VisionScrollParams
  ): Promise<VisionScrollResult> {
    return super.post<VisionScrollResult>(
      `${API_PREFIX}/boxes/${boxId}/browser-contexts/${contextId}/pages/${pageId}/actions/vision-scroll`,
      params
    );
  }
}
