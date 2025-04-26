import type { AxiosInstance } from 'axios';
import { Client } from './http-client.ts';
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
  BoxRunOptions,
} from '../types/box.ts';

const API_PREFIX = '/api/v1/boxes';

export class BoxApi extends Client {
  /**
   * List boxes with optional filters.
   * GET /api/v1/boxes
   */
  async list(
    filters?: BoxListFilters,
    signal?: AbortSignal
  ): Promise<BoxListResponse> {
    let params: Record<string, string | string[]> = {};
    if (filters) {
      const filterParams: string[] = [];
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          value.forEach((item) => filterParams.push(`${key}=${item}`));
        } else if (value !== undefined) {
          filterParams.push(`${key}=${value}`);
        }
      }
      if (filterParams.length > 0) {
        params['filter'] = filterParams;
      }
    }
    const response = await super.get<BoxListResponse>(
      API_PREFIX,
      params,
      undefined,
      signal
    );
    response.boxes = response.boxes.map((box) => this.mapLabels(box));
    return response;
  }

  /**
   * Get details of a specific box.
   * GET /api/v1/boxes/{id}
   */
  async getDetails(
    boxId: string,
    signal?: AbortSignal
  ): Promise<BoxGetResponse> {
    const response = await super.get<BoxGetResponse>(
      `${API_PREFIX}/${boxId}`,
      undefined,
      undefined,
      signal
    );
    return this.mapLabels(response);
  }

  /**
   * Create a new box.
   * POST /api/v1/boxes
   */
  async create(
    options: BoxCreateOptions,
    signal?: AbortSignal
  ): Promise<BoxCreateResponse> {
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
    const response = await super.post<BoxCreateResponse>(
      API_PREFIX,
      apiOptions,
      undefined,
      undefined,
      signal
    );

    const mappedResponse = this.mapLabels(response);

    return mappedResponse;
  }

  /**
   * Delete a specific box.
   * DELETE /api/v1/boxes/{id}
   */
  async deleteBox(
    boxId: string,
    force: boolean = false,
    signal?: AbortSignal
  ): Promise<{ message: string }> {
    const data = force ? { force } : undefined;
    return super.delete<{ message: string }>(
      `${API_PREFIX}/${boxId}`,
      data,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Delete all boxes.
   * DELETE /api/v1/boxes
   */
  async deleteAll(
    force: boolean = false,
    signal?: AbortSignal
  ): Promise<BoxesDeleteResponse> {
    const data = force ? { force } : undefined;
    return super.delete<BoxesDeleteResponse>(
      API_PREFIX,
      data,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Start a specific box.
   * POST /api/v1/boxes/{id}/start
   */
  async start(
    boxId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; message: string }> {
    return super.post<{ success: boolean; message: string }>(
      `${API_PREFIX}/${boxId}/start`,
      {},
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Stop a specific box.
   * POST /api/v1/boxes/{id}/stop
   */
  async stop(
    boxId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; message: string }> {
    return super.post<{ success: boolean; message: string }>(
      `${API_PREFIX}/${boxId}/stop`,
      {},
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Run a command in a box.
   * POST /api/v1/boxes/{id}/run
   */
  async run(
    boxId: string,
    command: string[],
    options?: BoxRunOptions,
    signal?: AbortSignal
  ): Promise<BoxRunResponse> {
    // Extract data payload fields from options
    const data = {
      cmd: command,
      ...(options?.stdin && { stdin: options.stdin }),
      ...(options?.stdoutLineLimit !== undefined && {
        stdout_line_limit: options.stdoutLineLimit,
      }),
      ...(options?.stderrLineLimit !== undefined && {
        stderr_line_limit: options.stderrLineLimit,
      }),
    };

    // Pass data payload and request config (with signal) separately
    const response = await super.post<BoxRunResponse>(
      `${API_PREFIX}/${boxId}/run`,
      data,
      undefined,
      undefined,
      signal
    );

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
  async reclaim(
    boxId?: string,
    force: boolean = false,
    signal?: AbortSignal
  ): Promise<BoxReclaimResponse> {
    const data = { force };
    const url = boxId
      ? `${API_PREFIX}/${boxId}/reclaim`
      : `${API_PREFIX}/reclaim`;
    return super.post<BoxReclaimResponse>(
      url,
      data,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Get files from a box as a tar archive.
   * GET /api/v1/boxes/{id}/archive
   */
  async getArchive(
    boxId: string,
    path: string,
    signal?: AbortSignal
  ): Promise<ArrayBuffer> {
    const params = { path };
    return super.getRaw(
      `${API_PREFIX}/${boxId}/archive`,
      params,
      { Accept: 'application/x-tar' },
      signal
    );
  }

  /**
   * Extract a tar archive to a box.
   * PUT /api/v1/boxes/{id}/archive
   */
  async extractArchive(
    boxId: string,
    path: string,
    archiveData: ArrayBuffer,
    signal?: AbortSignal
  ): Promise<BoxExtractArchiveResponse> {
    const params = { path };
    return super.putRaw<BoxExtractArchiveResponse>(
      `${API_PREFIX}/${boxId}/archive`,
      archiveData,
      params,
      { 'Content-Type': 'application/x-tar' },
      signal
    );
  }

  /**
   * Get metadata about files in a box.
   * HEAD /api/v1/boxes/{id}/archive
   */
  async headArchive(
    boxId: string,
    path: string,
    signal?: AbortSignal
  ): Promise<Record<string, string>> {
    const params = { path };
    return super.head(
      `${API_PREFIX}/${boxId}/archive`,
      params,
      undefined,
      signal
    );
  }

  // Helper to map extra_labels from API to labels in SDK consistently
  // Ensure input/output types are correct (T should extend BoxCreateResponse potentially)
  private mapLabels<
    T extends Partial<BoxData> & {
      extra_labels?: Record<string, string>;
      message?: string;
    },
  >(data: T): T & { labels?: Record<string, string> } {
    if (data && data.extra_labels) {
      data.labels = { ...(data.labels || {}), ...data.extra_labels };
      delete data.extra_labels;
    }
    return data;
  }
}
