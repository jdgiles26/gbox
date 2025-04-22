import type { AxiosInstance } from 'axios';
import { Client } from './client.ts';
import type {
  BoxCreateOptions,
  BoxCreateResponse,
  BoxData,
  BoxGetResponse,
  BoxListFilters,
  BoxListResponse,
  BoxesDeleteResponse,
  BoxReclaimResponse,
  BoxRunResponse,
  BoxExtractArchiveResponse,
} from '../types/box.ts';

const API_PREFIX = '/api/v1';

export class BoxApi extends Client {

  /**
   * List boxes with optional filters.
   * GET /api/v1/boxes
   */
  async list(filters?: BoxListFilters): Promise<BoxListResponse> {
    let params: Record<string, string | string[]> = {};
    if (filters) {
      const filterParams: string[] = [];
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          value.forEach(item => filterParams.push(`${key}=${item}`));
        } else if (value !== undefined) {
          filterParams.push(`${key}=${value}`);
        }
      }
      if (filterParams.length > 0) {
        params['filter'] = filterParams;
      }
    }
    const response = await super.get<BoxListResponse>(`${API_PREFIX}/boxes`, params);
    response.boxes = response.boxes.map(box => this.mapLabels(box));
    return response;
  }

  /**
   * Get details of a specific box.
   * GET /api/v1/boxes/{id}
   */
  async getDetails(boxId: string): Promise<BoxGetResponse> {
    const response = await super.get<BoxGetResponse>(`${API_PREFIX}/boxes/${boxId}`);
    return this.mapLabels(response);
  }

  /**
   * Create a new box.
   * POST /api/v1/boxes
   */
  async create(options: BoxCreateOptions): Promise<BoxCreateResponse> {
    const apiOptions: Record<string, any> = { ...options };
    if (options.labels) {
      apiOptions.extra_labels = options.labels;
      delete apiOptions.labels;
    }
    if (options.imagePullSecret) {
      apiOptions.imagePullSecret = options.imagePullSecret;
    }
    if (options.workingDir) {
      apiOptions.workingDir = options.workingDir;
    }
    const response = await super.post<BoxCreateResponse>(`${API_PREFIX}/boxes`, apiOptions);

    const mappedResponse = this.mapLabels(response);

    return mappedResponse;
  }

  /**
   * Delete a specific box.
   * DELETE /api/v1/boxes/{id}
   */
  async deleteBox(boxId: string, force: boolean = false): Promise<{ message: string }> {
    const data = force ? { force } : undefined;
    return super.delete<{ message: string }>(`${API_PREFIX}/boxes/${boxId}`, data);
  }

  /**
   * Delete all boxes.
   * DELETE /api/v1/boxes
   */
  async deleteAll(force: boolean = false): Promise<BoxesDeleteResponse> {
    const data = force ? { force } : undefined;
    return super.delete<BoxesDeleteResponse>(`${API_PREFIX}/boxes`, data);
  }

  /**
   * Start a specific box.
   * POST /api/v1/boxes/{id}/start
   */
  async start(boxId: string): Promise<{ success: boolean; message: string }> {
    return super.post<{ success: boolean; message: string }>(`${API_PREFIX}/boxes/${boxId}/start`, {});
  }

  /**
   * Stop a specific box.
   * POST /api/v1/boxes/{id}/stop
   */
  async stop(boxId: string): Promise<{ success: boolean; message: string }> {
    return super.post<{ success: boolean; message: string }>(`${API_PREFIX}/boxes/${boxId}/stop`, {});
  }

  /**
   * Run a command in a box.
   * POST /api/v1/boxes/{id}/run
   */
  async run(boxId: string, command: string[]): Promise<BoxRunResponse> {
    const data = { cmd: command };
    const response = await super.post<BoxRunResponse>(`${API_PREFIX}/boxes/${boxId}/run`, data);
    if (response.box) {
      response.box = this.mapLabels(response.box);
    }
    return response;
  }

  /**
   * Reclaim resources for a specific box or all inactive boxes.
   * POST /api/v1/boxes/reclaim
   * POST /api/v1/boxes/{id}/reclaim
   */
  async reclaim(boxId?: string, force: boolean = false): Promise<BoxReclaimResponse> {
    const data = { force };
    const url = boxId ? `${API_PREFIX}/boxes/${boxId}/reclaim` : `${API_PREFIX}/boxes/reclaim`;
    return super.post<BoxReclaimResponse>(url, data);
  }

  /**
   * Get files from a box as a tar archive.
   * GET /api/v1/boxes/{id}/archive
   */
  async getArchive(boxId: string, path: string): Promise<ArrayBuffer> {
    const params = { path };
    return super.getRaw(`${API_PREFIX}/boxes/${boxId}/archive`, params, { 'Accept': 'application/x-tar' });
  }

  /**
   * Extract a tar archive to a box.
   * PUT /api/v1/boxes/{id}/archive
   */
  async extractArchive(boxId: string, path: string, archiveData: ArrayBuffer): Promise<BoxExtractArchiveResponse> {
    const params = { path };
    return super.putRaw<BoxExtractArchiveResponse>(
        `${API_PREFIX}/boxes/${boxId}/archive`,
        archiveData,
        params,
        { 'Content-Type': 'application/x-tar' }
    );
  }

  /**
   * Get metadata about files in a box.
   * HEAD /api/v1/boxes/{id}/archive
   */
  async headArchive(boxId: string, path: string): Promise<Record<string, string>> {
    const params = { path };
    return super.head(`${API_PREFIX}/boxes/${boxId}/archive`, params);
  }

  // Helper to map extra_labels from API to labels in SDK consistently
  // Ensure input/output types are correct (T should extend BoxCreateResponse potentially)
  private mapLabels<T extends Partial<BoxData> & { extra_labels?: Record<string, string>, message?: string }>(data: T): T & { labels?: Record<string, string> } {
    if (data && data.extra_labels) {
      data.labels = { ...(data.labels || {}), ...data.extra_labels };
      delete data.extra_labels;
    }
    return data;
  }
} 