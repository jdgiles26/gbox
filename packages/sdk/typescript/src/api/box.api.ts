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
  BoxExecProcess,
  BoxExecOptions,
} from '../types/box.ts';
import { StreamTypeStdout, StreamTypeStderr } from '../types/box.ts';
import { WebSocketClient } from './ws-client.ts';


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

  /**
   * Execute a command in a box via WebSocket, wait for completion, and return buffered output.
   * Connects via GET /ws/boxes/{id}/exec?cmd=...&arg=...&tty=...
   *
   * @param boxId The ID of the box.
   * @param cmd The command and its arguments as an array of strings.
   * @param options Optional settings like tty mode and abort signal.
   * @returns An object containing Readable streams for stdout and stderr, and a Promise for the exit code.
   */
  async exec(
    boxId: string,
    cmd: string[],
    options?: BoxExecOptions
  ): Promise<BoxExecProcess> {
    const { tty = false, signal, workingDir, stdin } = options ?? {};

    if (!cmd || cmd.length === 0) {
      throw new Error('cmd must be a non-empty array');
    }

    // Construct the full WebSocket URL using the helper, passing workingDir
    const wsUrlString = this.buildExecWsUrl(boxId, { cmd, tty, workingDir });
    this.logger.debug(`[GBox SDK exec] Constructed WebSocket URL: ${wsUrlString}`);

    // Create streams
    let stdoutController!: ReadableStreamDefaultController<Uint8Array>;
    const stdoutStream = new ReadableStream<Uint8Array>({
      start(controller) {
        stdoutController = controller;
      }
    });

    let stderrController!: ReadableStreamDefaultController<Uint8Array>;
    const stderrStream = new ReadableStream<Uint8Array>({
      start(controller) {
        stderrController = controller;
      }
    });

    // Create promise for exit code
    let resolveExitCode!: (code: number) => void;
    let rejectExitCode!: (reason?: any) => void;
    const exitCodePromise = new Promise<number>((resolve, reject) => {
      resolveExitCode = resolve;
      rejectExitCode = reject;
    });

    // Return streams and promise immediately
    const execProcess: BoxExecProcess = { stdout: stdoutStream, stderr: stderrStream, exitCode: exitCodePromise };

    // Run WebSocket connection logic in the background (don't await the outer promise)
    new Promise<void>((resolveWs, rejectWs) => { // Inner promise for WS lifecycle
      let receivedExitCode: number | null = null;
      let frameBuffer = new Uint8Array(0); // Buffer for fragmented Docker frames
      let wsClientInstance: WebSocketClient | null = null;
      let connectionError: Error | null = null;

      // Helper async function to handle writing stdin to WebSocket
      const handleStdin = async (ws: WebSocketClient, input: string | ReadableStream<Uint8Array>) => {
        this.logger.debug('[GBox SDK exec] Starting stdin handling.');
        try {
          if (typeof input === 'string') {
            const encoder = new TextEncoder();
            const data = encoder.encode(input);
            if (data.length > 0) {
               // Create a slice to ensure we get a plain ArrayBuffer, then send its buffer
               await ws.send(data.slice().buffer);
               this.logger.debug(`[GBox SDK exec] Sent ${data.length} bytes from string stdin.`);
            }
          } else if (input instanceof ReadableStream) {
            const reader = input.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                this.logger.debug('[GBox SDK exec] stdin stream finished.');
                break;
              }
              if (value && value.length > 0) {
                 // Create a slice to ensure we get a plain ArrayBuffer, then send its buffer
                 // IMPORTANT: Await the send operation to ensure data is sent before the next read or EOF
                 await ws.send(value.slice().buffer);
                 this.logger.debug(`[GBox SDK exec] Sent ${value.length} bytes from stdin stream.`);
              }
            }
            reader.releaseLock();
          }
          this.logger.debug('[GBox SDK exec] Finished writing stdin. Sending stdin_eof control message.');
          // Send the control message to signal EOF
          const eofMsg = JSON.stringify({ type: 'stdin_eof' });
          await ws.send(eofMsg);
          // DO NOT close the WebSocket here. It needs to stay open to receive stdout/stderr and the exit code.
        } catch (error: any) {
          this.logger.error('[GBox SDK exec] Error writing to stdin via WebSocket:', error);
        }
      };

      // Instantiate the client and connect
      wsClientInstance = new WebSocketClient(wsUrlString, {
        signal: signal,
        onOpen: () => {
          this.logger.debug('[GBox SDK exec] WebSocket connection opened.');
          // Start handling stdin *after* connection is open
          if (stdin && wsClientInstance) {
            handleStdin(wsClientInstance, stdin); // Don't await this, let it run in background
          }
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
                  if (stdoutController) {
                      stdoutController.enqueue(new Uint8Array(data));
                  }
                } else {
                  // Non-TTY mode: Process raw Docker stream with 8-byte header
                  // Append new data to our frame buffer
                  const newData = new Uint8Array(data);
                  const combined = new Uint8Array(frameBuffer.length + newData.length);
                  combined.set(frameBuffer, 0);
                  combined.set(newData, frameBuffer.length);
                  frameBuffer = combined;

                  // Process as many complete frames as possible from the buffer
                  while (frameBuffer.length >= 8) {
                    const header = frameBuffer.slice(0, 8);
                    const dataView = new DataView(header.buffer, header.byteOffset, header.byteLength);
                    const streamType = dataView.getUint8(0) as StreamType;
                    // Bytes 1, 2, 3 are reserved
                    const payloadSize = dataView.getUint32(4, false); // false for big-endian

                    const frameSize = 8 + payloadSize;

                    // Check if the buffer contains the full frame
                    if (frameBuffer.length >= frameSize) {
                      const payload = frameBuffer.slice(8, frameSize);
                      if (payload.byteLength > 0) {
                         // Extract payload and append to correct buffer
                         if (streamType === StreamTypeStdout) {
                             if (stdoutController) {
                                 stdoutController.enqueue(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength));
                             }
                         } else if (streamType === StreamTypeStderr) {
                             if (stderrController) {
                                 stderrController.enqueue(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength));
                             }
                         }
                         // Ignore StreamTypeStdin (0) if received, though unlikely
                      }
                      // Remove the processed frame from the buffer
                      frameBuffer = frameBuffer.slice(frameSize);
                    } else {
                      // Full frame not yet available, wait for more data
                      break;
                    }
                  }
                }
            }
          } else {
            this.logger.warn(`[GBox SDK exec] Received message of unknown type: ${typeof data}`, data);
          }
        },
        onError: (error: Error) => {
          this.logger.error('[GBox SDK exec] WebSocket error:', error);
          // Signal error to streams and exit code promise
          if (stdoutController) stdoutController.error(error);
          if (stderrController) stderrController.error(error);
          rejectExitCode(error);
          rejectWs(error); // Reject the inner WS promise
        },
        onClose: (code: number, reason: string, wasClean: boolean) => {
          this.logger.debug(
            `[GBox SDK exec] WebSocket closed. Code: ${code}, Reason: ${reason}, WasClean: ${wasClean}`
          );

          // If connectionError occurred, onError already handled cleanup
          if (connectionError) return;

          // Check if there's remaining data in the frame buffer (should ideally be empty if stream closed cleanly)
          if (!tty && frameBuffer.length > 0) {
             this.logger.warn(`[GBox SDK exec] WebSocket closed with ${frameBuffer.length} unprocessed bytes in frame buffer.`);
             // Depending on requirements, you might want to reject or try processing the remaining bytes
             // For simplicity, we'll log a warning and proceed.
          }

          if (receivedExitCode !== null) {
            // Exit code received before close, resolve
            resolveExitCode(receivedExitCode);
            // Signal end of streams
            if (stdoutController) stdoutController.close();
            if (stderrController) stderrController.close();
            resolveWs(); // Resolve the inner WS promise
          } else {
            // Closed without receiving exit code - treat as an error
            const closeError = new Error(`WebSocket closed (Code: ${code}, Reason: ${reason}, Clean: ${wasClean}) before receiving exit code.`);
            if (stdoutController) stdoutController.error(closeError);
            if (stderrController) stderrController.error(closeError);
            rejectExitCode(closeError);
            rejectWs(closeError); // Reject the inner WS promise
          }
        },
      }, this.logger); // Pass the logger instance

      // Initiate connection and handle initial failure
      wsClientInstance.connect().catch(initialError => {
        this.logger.error('[GBox SDK exec] Initial WebSocket connection failed:', initialError);
        // Destroy streams and reject promise if initial connection fails
        if (stdoutController) stdoutController.error(initialError);
        if (stderrController) stderrController.error(initialError);
        rejectExitCode(initialError);
        rejectWs(initialError); // Reject the inner WS promise
      });
    }).catch(wsError => {
        // Catch errors from the inner WS promise (already handled by rejectExitCode/stream destroy)
        this.logger.debug('[GBox SDK exec] WebSocket lifecycle promise rejected:', wsError.message);
    });

    // IMPORTANT: Return the object with streams/promise immediately
    return execProcess;
  }

  // Helper to construct the full WebSocket URL for the exec command
  private buildExecWsUrl(boxId: string, params: { cmd: string[]; tty: boolean; workingDir?: string }): string {
    const httpUrl = this.httpClient.defaults.baseURL;
    if (!httpUrl) {
      throw new Error('Cannot determine WebSocket URL: Axios baseURL is not set.');
    }

    const { cmd, tty, workingDir } = params;

    // Use API_PREFIX for the base path, as the route is under the API
    const wsBasePath = `${API_PREFIX}/${boxId}/exec/ws`;
    const url = new URL(wsBasePath, httpUrl); // Use httpUrl to resolve potential relative paths

    // Switch protocol from HTTP(S) to WS(S)
    url.protocol = url.protocol.replace(/^http/, 'ws');

    // Build search parameters
    // Ensure 'cmd' is treated as the command and subsequent elements as 'arg'
    if (cmd.length > 0) {
      url.searchParams.set('cmd', cmd[0]);
      cmd.slice(1).forEach(arg => url.searchParams.append('arg', arg));
    }
    if (tty) {
      url.searchParams.set('tty', 'true');
    }
    if (workingDir) {
      url.searchParams.set('workingDir', workingDir);
    }

    return url.toString();
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
