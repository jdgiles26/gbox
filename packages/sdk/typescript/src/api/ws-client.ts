import WebSocket from 'isomorphic-ws';

// Define interfaces for event types based on expected properties
interface WebSocketMessageEvent {
    data: ArrayBuffer | string;
    // Add other properties if needed
}

interface WebSocketErrorEvent {
    error?: any;       // Node ws uses 'error', browser uses 'message'
    message?: string;
    type: string;
    // Add other properties if needed
}

interface WebSocketCloseEvent {
    code: number;
    reason: string;
    wasClean: boolean;
    // Add other properties if needed
}

export interface WebSocketClientOptions {
  onOpen?: () => void;
  onMessage?: (data: ArrayBuffer | string) => void; // Callback for raw messages
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: string, wasClean: boolean) => void;
  signal?: AbortSignal; // Optional abort signal
}

export interface IWebSocketClient {
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  get readyState(): number;
}

/**
 * A basic WebSocket client wrapper.
 */
export class WebSocketClient implements IWebSocketClient {
  private ws: WebSocket | null = null;
  private connectionUrl: string;
  private options: WebSocketClientOptions;
  private connectionPromise: Promise<void>;
  private resolveConnectionPromise!: () => void;
  private rejectConnectionPromise!: (reason?: any) => void;
  private connectionEstablished = false;
  private logger: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>; // Added logger

  constructor(url: string, options: WebSocketClientOptions = {}, logger: Pick<Console, 'debug' | 'info' | 'warn' | 'error'> = console) {
    this.connectionUrl = url;
    this.options = options;
    this.logger = logger; // Store logger
    this.connectionPromise = new Promise((resolve, reject) => {
      this.resolveConnectionPromise = resolve;
      this.rejectConnectionPromise = reject;
    });
  }

  /**
   * Initiates the WebSocket connection.
   * Returns a promise that resolves when the connection is open,
   * or rejects if the initial connection fails or is aborted.
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
       this.logger.warn('[WebSocketClient] WebSocket connection already established or in progress.');
       return this.connectionPromise;
    }

    this.connectionEstablished = false;
    this.logger.debug(`[WebSocketClient] Connecting to ${this.connectionUrl}`);
    this.ws = new WebSocket(this.connectionUrl);
    this.ws.binaryType = 'arraybuffer';

    const handleAbort = () => {
      this.logger.debug('[WebSocketClient] Abort signal received.');
      if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
        this.ws.close(1000, 'Aborted by user');
      }
       // Reject the connection promise only if connection wasn't established yet
       if (!this.connectionEstablished) {
           this.rejectConnectionPromise(new Error('WebSocket connection aborted by user signal before opening.'));
       }
    };

    const signal = this.options.signal;
    if (signal) {
      // --- Modification Start: Handle pre-aborted signal ---
      // Check if already aborted before adding listener
      if (signal.aborted) {
        handleAbort(); // Will reject connectionPromise
        return this.connectionPromise; // Return the rejected promise immediately
      }
      // --- Modification End ---
      signal.addEventListener('abort', handleAbort, { once: true });
    }

    const cleanupAbortListener = () => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
    };

    this.ws.onopen = () => {
      this.logger.debug('[WebSocketClient] WebSocket opened.');
      this.connectionEstablished = true;
      cleanupAbortListener();
      this.options.onOpen?.();
      this.resolveConnectionPromise(); // Resolve the promise on successful open
    };

    // Use the defined interface for the event type
    this.ws.onmessage = (event: WebSocketMessageEvent) => {
      // Pass raw data to the message handler
      this.options.onMessage?.(event.data as (ArrayBuffer | string));
    };

    // Use the defined interface for the event type
    this.ws.onerror = (event: WebSocketErrorEvent) => {
      // Use event.error if available (provides more details sometimes), fallback to type/message
      const errorMessage = event.error?.message || event.message || event.type || 'Unknown WebSocket error';
      const error = new Error(`WebSocket error: ${errorMessage}`);
      // Attach the original error object if it exists
      if (event.error) {
         (error as any).originalError = event.error;
      }
      this.logger.error('[WebSocketClient] WebSocket error:', error);
      cleanupAbortListener();
       if (!this.connectionEstablished) {
           // If connection never established, reject the connection promise
           this.rejectConnectionPromise(error);
       } else {
           // If connection was established, call the onError callback
           this.options.onError?.(error);
       }
    };

    // Use the defined interface for the event type
    this.ws.onclose = (event: WebSocketCloseEvent) => {
      this.logger.debug(
        `[WebSocketClient] WebSocket closed. Code: ${event.code}, Reason: ${event.reason}, WasClean: ${event.wasClean}`
      );
      cleanupAbortListener();
       // Reject connection promise only if it closed uncleanly *before* opening
       if (!this.connectionEstablished && !event.wasClean && event.code !== 1000) {
            this.rejectConnectionPromise(new Error(`WebSocket closed unexpectedly before opening. Code: ${event.code}, Reason: ${event.reason}`));
       }
      // Always call the onClose handler if provided
      this.options.onClose?.(event.code, event.reason, event.wasClean);
    };

    return this.connectionPromise;
  }

  send(data: string | ArrayBuffer, options?: { throwIfNotOpen?: boolean }): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.logger.warn('[WebSocketClient] WebSocket is not open, cannot send data.');
      // --- Modification Start: Optionally throw error ---
      if (options?.throwIfNotOpen) {
        throw new Error('WebSocket is not open, cannot send data.');
      }
    }
  }

  close(code: number = 1000, reason: string = 'Connection closed by client'): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close(code, reason);
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED; // Return CLOSED if ws is null
  }
} 