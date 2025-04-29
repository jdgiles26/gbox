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
  StreamType,
  ExitMessage,
  BoxExecResult,
  BoxExecOptions,
} from '../types/box.ts';
import { StreamTypeStdout, StreamTypeStderr } from '../types/box.ts';
import { WebSocketClient } from './ws-client.ts';


const API_PREFIX = '/api/v1/boxes';
const WS_PREFIX = '/ws/boxes';

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

  /**
   * Execute a command in a box via WebSocket, wait for completion, and return buffered output.
   * Connects via GET /ws/boxes/{id}/exec?cmd=...&arg=...&tty=...
   *
   * @param boxId The ID of the box.
   * @param cmd The command and its arguments as an array of strings.
   * @param options Optional settings like tty mode and abort signal.
   * @returns A promise that resolves with the exit code, stdout/stderr strings and buffers.
   */
  async exec(
    boxId: string,
    cmd: string[],
    options?: BoxExecOptions
  ): Promise<BoxExecResult> {
    const { tty = false, signal } = options ?? {};

    if (!cmd || cmd.length === 0) {
      throw new Error('cmd must be a non-empty array');
    }

    // Construct the full WebSocket URL using the helper
    const wsUrlString = this.buildExecWsUrl(boxId, { cmd, tty });
    this.logger.debug(`[GBox SDK exec] Constructed WebSocket URL: ${wsUrlString}`);

    return new Promise<BoxExecResult>((resolve, reject) => {
      let receivedExitCode: number | null = null;
      const rawStdoutBuffer: ArrayBuffer[] = []; // Store raw stdout buffers
      const rawStderrBuffer: ArrayBuffer[] = []; // Store raw stderr buffers
      let wsClientInstance: WebSocketClient | null = null;
      let connectionError: Error | null = null;

      // Instantiate the client and connect
      wsClientInstance = new WebSocketClient(wsUrlString, {
        signal: signal,
        onOpen: () => {
          this.logger.debug('[GBox SDK exec] WebSocket connection opened.');
          // Connection is open, waiting for messages...
        },
        onMessage: (data: ArrayBuffer | string) => {
          if (typeof data === 'string') {
            try {
              const jsonMessage = JSON.parse(data);
              const exitMsg = jsonMessage as ExitMessage;
              if (exitMsg?.type === 'exit' && typeof exitMsg.exitCode === 'number') {
                this.logger.debug(`[GBox SDK exec] Received exit message: Code ${exitMsg.exitCode}`);
                receivedExitCode = exitMsg.exitCode;
                // Don't close here, wait for server to close or onClose event
              } else {
                this.logger.warn(`[GBox SDK exec] Received unexpected JSON text message:`, jsonMessage);
              }
            } catch (e) {
              this.logger.warn(`[GBox SDK exec] Received non-JSON text message: ${data}`);
            }
          } else if (data instanceof ArrayBuffer) {
            if (data.byteLength > 0) {
                if (tty) {
                  // TTY mode: all output is considered stdout
                  rawStdoutBuffer.push(data);
                } else {
                  // Non-TTY mode: First byte is stream type, rest is payload
                  const streamType = new Uint8Array(data, 0, 1)[0] as StreamType;
                  const payload = data.slice(1); // Get the actual content
                  if (payload.byteLength > 0) {
                    if (streamType === StreamTypeStdout) {
                       rawStdoutBuffer.push(payload);
                    } else if (streamType === StreamTypeStderr) {
                       rawStderrBuffer.push(payload);
                    }
                    // Ignore StreamTypeStdin (0) if received
                  }
                }
            }
          } else {
            this.logger.warn(`[GBox SDK exec] Received message of unknown type: ${typeof data}`, data);
          }
        },
        onError: (error: Error) => {
          this.logger.error('[GBox SDK exec] WebSocket error:', error);
          connectionError = error; // Store error to reject in onClose
        },
        onClose: (code: number, reason: string, wasClean: boolean) => {
          this.logger.debug(
            `[GBox SDK exec] WebSocket closed. Code: ${code}, Reason: ${reason}, WasClean: ${wasClean}`
          );

          if (connectionError) {
            reject(connectionError);
            return;
          }

          if (receivedExitCode !== null) {
            // Exit code received, process buffers
            const stdoutBuffer = this.concatBuffers(rawStdoutBuffer);
            const stderrBuffer = this.concatBuffers(rawStderrBuffer);
            const decoder = new TextDecoder(); // Default UTF-8
            const stdout = decoder.decode(stdoutBuffer);
            const stderr = decoder.decode(stderrBuffer);
            // Resolve with strings and buffers
            resolve({ exitCode: receivedExitCode, stdout, stderr, stdoutBuffer, stderrBuffer });
          } else {
            // Closed without receiving exit code - treat as an error
            reject(new Error(`WebSocket closed (Code: ${code}, Reason: ${reason}, Clean: ${wasClean}) before receiving exit code.`));
          }
        },
      }, this.logger); // Pass the logger instance

      // Initiate connection and handle initial failure
      wsClientInstance.connect().catch(initialError => {
        this.logger.error('[GBox SDK exec] Initial WebSocket connection failed:', initialError);
        reject(initialError); // Reject the main exec promise
      });
    });
  }

  // Helper to construct the full WebSocket URL for the exec command
  private buildExecWsUrl(boxId: string, params: { cmd: string[]; tty: boolean }): string {
    const httpUrl = this.httpClient.defaults.baseURL;
    if (!httpUrl) {
      throw new Error('Cannot determine WebSocket URL: Axios baseURL is not set.');
    }

    const { cmd, tty } = params;

    const basePath = `${API_PREFIX}/${boxId}/exec/ws`;
    const url = new URL(basePath, httpUrl);


    // Switch protocol from HTTP(S) to WS(S)
    url.protocol = url.protocol.replace(/^http/, 'ws');

    // Build search parameters
    url.searchParams.set('cmd', cmd[0]);
    cmd.slice(1).forEach(arg => url.searchParams.append('arg', arg));
    if (tty) {
      url.searchParams.set('tty', 'true');
    }

    return url.toString();
  }

  // Helper to concatenate ArrayBuffers
  private concatBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
      let totalLength = 0;
      for (const buffer of buffers) {
          totalLength += buffer.byteLength;
      }

      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const buffer of buffers) {
          result.set(new Uint8Array(buffer), offset);
          offset += buffer.byteLength;
      }
      return result.buffer;
  }

  // Helper to map extra_labels from API to labels in SDK consistently
  // Ensure input/output types are correct (T should extend BoxCreateResponse potentially)
  private mapLabels<T extends Partial<BoxData> & { extra_labels?: Record<string, string>; message?: string; }>(data: T): T & { labels?: Record<string, string> } {
    if (data && data.extra_labels) {
      data.labels = { ...(data.labels || {}), ...data.extra_labels };
      delete data.extra_labels;
    }
    return data;
  }
}
