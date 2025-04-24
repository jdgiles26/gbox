import { BrowserApi } from '../api/browser.api.ts';
import type {
  GetPageResult,
  VisionClickParams, VisionClickResult,
  VisionDoubleClickParams, VisionDoubleClickResult,
  VisionDragParams, VisionDragResult,
  VisionKeyPressParams, VisionKeyPressResult,
  VisionMoveParams, VisionMoveResult,
  VisionScreenshotParams, VisionScreenshotResult,
  VisionScrollParams, VisionScrollResult,
  VisionTypeParams, VisionTypeResult
} from '../types/browser.ts';

/**
 * Represents a single browser page within a BrowserContext.
 * Provides methods to interact with the page content and perform actions.
 */
export class BrowserPage {
  public readonly id: string;
  public readonly contextId: string;
  public readonly boxId: string;
  private readonly api: BrowserApi; // Holds the reference to the BrowserApi client

  /**
   * Constructs a new BrowserPage instance.
   * Typically created via BrowserContext.createPage() or BrowserContext.getPage().
   * @param id - The unique identifier of the page.
   * @param contextId - The identifier of the parent BrowserContext.
   * @param boxId - The identifier of the Box containing the context and page.
   * @param api - The BrowserApi instance for making API calls.
   */
  constructor(id: string, contextId: string, boxId: string, api: BrowserApi) {
    this.id = id;
    this.contextId = contextId;
    this.boxId = boxId;
    this.api = api;
  }

  /**
   * Retrieves the content of the page.
   * @param contentType - The desired format of the content ('html' or 'markdown'). Defaults to 'html'.
   * @returns A promise that resolves with the page details and content.
   */
  async getContent(contentType: 'html' | 'markdown' = 'html'): Promise<GetPageResult> {
    return await this.api.getPage(this.boxId, this.contextId, this.id, true, contentType);
  }

  /**
   * Performs a click action on the page based on visual context.
   * @param params - Parameters for the click action (e.g., description of the element to click).
   * @returns A promise that resolves with the result of the click action.
   */
  async click(params: VisionClickParams): Promise<VisionClickResult> {
    return await this.api.visionClick(this.boxId, this.contextId, this.id, params);
  }

  /**
   * Performs a double click action on the page based on visual context.
   * @param params - Parameters for the double click action.
   * @returns A promise that resolves with the result of the double click action.
   */
   async doubleClick(params: VisionDoubleClickParams): Promise<VisionDoubleClickResult> {
    return await this.api.visionDoubleClick(this.boxId, this.contextId, this.id, params);
  }

  /**
   * Types text into the page based on visual context or a selector.
   * @param params - Parameters for the type action (e.g., text to type, target element description).
   * @returns A promise that resolves with the result of the type action.
   */
  async type(params: VisionTypeParams): Promise<VisionTypeResult> {
    return await this.api.visionType(this.boxId, this.contextId, this.id, params);
  }

   /**
   * Performs a drag action on the page based on visual context.
   * @param params - Parameters for the drag action (start and end points/descriptions).
   * @returns A promise that resolves with the result of the drag action.
   */
  async drag(params: VisionDragParams): Promise<VisionDragResult> {
    return await this.api.visionDrag(this.boxId, this.contextId, this.id, params);
  }

  /**
   * Simulates a key press action on the page.
   * @param params - Parameters for the key press action (e.g., the key to press).
   * @returns A promise that resolves with the result of the key press action.
   */
  async keyPress(params: VisionKeyPressParams): Promise<VisionKeyPressResult> {
    return await this.api.visionKeyPress(this.boxId, this.contextId, this.id, params);
  }

  /**
   * Moves the mouse cursor on the page based on visual context.
   * @param params - Parameters for the move action (target description or coordinates).
   * @returns A promise that resolves with the result of the move action.
   */
  async move(params: VisionMoveParams): Promise<VisionMoveResult> {
    return await this.api.visionMove(this.boxId, this.contextId, this.id, params);
  }

  /**
   * Takes a screenshot of the page based on visual context.
   * @param params - Parameters for the screenshot action (e.g., area description).
   * @returns A promise that resolves with the screenshot result (often includes image data).
   */
  async screenshot(params: VisionScreenshotParams): Promise<VisionScreenshotResult> {
    return await this.api.visionScreenshot(this.boxId, this.contextId, this.id, params);
  }


  /**
   * Scrolls the page based on visual context or direction.
   * @param params - Parameters for the scroll action (e.g., direction, amount, target element).
   * @returns A promise that resolves with the result of the scroll action.
   */
  async scroll(params: VisionScrollParams): Promise<VisionScrollResult> {
    return await this.api.visionScroll(this.boxId, this.contextId, this.id, params);
  }


  /**
   * Closes this specific browser page.
   * @returns A promise that resolves when the page has been closed.
   */
  async close(): Promise<void> {
    await this.api.closePage(this.boxId, this.contextId, this.id);
  }
} 