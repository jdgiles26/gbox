import { BoxApi } from '../api/box.api.ts';
import { BrowserApi } from '../api/browser.api.ts'; // Import BrowserApi
import { Box } from '../models/box.ts'; // Import the Box class
// Use import type for interfaces/types
import type {
    BoxCreateOptions,
    BoxData,
    BoxListFilters,
    BoxesDeleteResponse,
    BoxReclaimResponse
} from '../types/box.ts';
import { APIError } from '../errors.ts'; // Errors are classes (runtime values), so no 'import type' needed here


export class BoxManager {
  private readonly boxApi: BoxApi;
  private readonly browserApi: BrowserApi; // Add browserApi property

  constructor(boxApi: BoxApi, browserApi: BrowserApi) {
    this.boxApi = boxApi;
    this.browserApi = browserApi; // Store browserApi
  }

  /**
   * Lists Boxes, optionally filtering them.
   *
   * @param filters Optional filters for listing boxes.
   * @returns A promise that resolves to a list of Box instances.
   */
  async list(filters?: BoxListFilters): Promise<Box[]> {
    const response = await this.boxApi.list(filters);
    // Wrap the raw BoxData in Box instances, passing both APIs
    return response.boxes.map(boxData => new Box(boxData, this.boxApi, this.browserApi));
  }

  /**
   * Retrieves a specific Box by its ID.
   *
   * @param boxId The ID of the Box.
   * @returns A promise that resolves to a Box instance.
   * @throws {NotFoundError} If the box is not found.
   * @throws {APIError} For other API errors.
   */
  async get(boxId: string): Promise<Box> {
    // Use the renamed BoxApi method
    const boxData = await this.boxApi.getDetails(boxId);
    // Pass both APIs to the Box constructor
    return new Box(boxData, this.boxApi, this.browserApi);
  }

  /**
   * Creates a new Box.
   *
   * @param options Options for creating the box (image, labels, etc.).
   * @returns A promise that resolves to the newly created Box instance.
   * @throws {APIError} If creation fails.
   */
  async create(options: BoxCreateOptions): Promise<Box> {
    const response = await this.boxApi.create(options);
    // Instantiate Box model directly using the response data, passing both APIs
    return new Box(response, this.boxApi, this.browserApi);
  }

  /**
   * Deletes all Boxes.
   *
   * @param force If true, attempt to force deletion.
   * @returns A promise that resolves to the deletion result.
   */
  async deleteAll(force: boolean = false): Promise<BoxesDeleteResponse> {
    return this.boxApi.deleteAll(force);
  }

  /**
   * Reclaims resources for all inactive Boxes.
   *
   * @param force If true, force reclamation.
   * @returns A promise that resolves to the reclamation result.
   */
  async reclaim(force: boolean = false): Promise<BoxReclaimResponse> {
    // Call the BoxApi method for reclaiming all boxes (boxId = undefined)
    return this.boxApi.reclaim(undefined, force);
  }
} 