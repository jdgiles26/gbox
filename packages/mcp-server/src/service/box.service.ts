import { Box } from '../../../sdk/typescript/src/models/box';
import {
    BoxCreateOptions,
    BoxRunResponse,
    BoxListFilters
} from '../../../sdk/typescript/src/types/box';
import { NotFoundError } from '../../../sdk/typescript/src/errors';
import { Logger } from '../sdk/types';
import client from './client'; // Import the default exported client instance

// Type assertion might be needed if the imported client's type isn't specific enough
// const typedClient = client as GBoxClient; // Example assertion if needed

export class BoxService {
    private readonly boxManager: typeof client.boxes; // Get the type from the client instance
    private readonly logger?: Logger; // Assuming a logger is passed or available
    private readonly defaultImage = 'ubuntu:latest'; // Example default image
    private readonly defaultCmd = ["sleep", "infinity"];
    private readonly defaultWaitTimeoutSeconds = 120; // Default timeout for waiting

    // TODO: Inject logger dependency if needed
    constructor(logger?: Logger) {
        // Use the imported client instance to access the BoxManager
        // If 'client' is not already typed as GBoxClient, you might need type assertion: (client as GBoxClient).boxes
        this.boxManager = client.boxes;
        this.logger = logger;
    }

    /**
     * Retrieves a list of Boxes, optionally filtered by sessionId or specific boxId.
     * Corresponds to the old getBoxes.
     */
    async getBoxes(options: { sessionId?: string; boxId?: string; signal?: AbortSignal }): Promise<{ boxes: Box[]; count: number }> {
        this.logger?.debug(`Getting boxes with options: ${JSON.stringify(options)}`);
        // New SDK's list filters might differ. Adapt as needed.
        // Currently, the new SDK BoxManager.list takes BoxListFilters, check its definition.
        // Let's assume simple filtering by ID for now if boxId is provided.
        // SessionId filtering might need label filtering `label: { sessionId: options.sessionId }`
        // AbortSignal is usually handled by the underlying client methods in the new SDK.

        try {
            let boxes: Box[];
            if (options.boxId) {
                // Fetch specific box if ID is given
                 try {
                    // Use boxManager from the initialized client
                    const box = await this.boxManager.get(options.boxId);
                    boxes = [box];
                 } catch (error: unknown) {
                    // FIX: Use imported NotFoundError for specific error handling
                    if (error instanceof NotFoundError) {
                         boxes = [];
                    } else {
                        throw error; // Re-throw other errors
                    }
                 }
            } else {
                 // FIX: Implement filtering using BoxListFilters
                 let filters: BoxListFilters | undefined;
                 if (options.sessionId) {
                    // Filter by label 'sessionId=value'
                    filters = { label: [`sessionId=${options.sessionId}`] };
                 }
                 boxes = await this.boxManager.list(filters); // Pass filters to manager
            }

            this.logger?.debug(`Found ${boxes.length} boxes.`);
            return { boxes, count: boxes.length };
        } catch (error) {
            this.logger?.error('Error getting boxes:', error);
            throw error;
        }
    }

    /**
     * Gets a specific Box by its ID.
     * Corresponds to the old getBox.
     */
    async getBox(id: string, options?: { signal?: AbortSignal; sessionId?: string }): Promise<Box> {
         this.logger?.debug(`Getting box with ID: ${id}, options: ${JSON.stringify(options)}`);
         // TODO: Handle sessionId filtering if necessary, maybe after getting the box?
         try {
            const box = await this.boxManager.get(id);
            // FIX: Use imported NotFoundError for specific error handling
            if (options?.sessionId && box.labels?.sessionId !== options.sessionId) {
                 // Throw an error indicating mismatch or not found in session
                 throw new Error(`Box ${id} found but does not belong to session ${options.sessionId}`);
            }
            this.logger?.debug(`Got box: ${box.id}`);
            return box;
         } catch (error: unknown) {
            // FIX: Use imported NotFoundError for specific error handling
            if (error instanceof NotFoundError || (error instanceof Error && error.message.includes('does not belong to session'))) {
                this.logger?.warn(`Error getting box ${id} (specific): ${error}`);
            } else {
                this.logger?.error(`Error getting box ${id} (generic):`, error);
            }
            throw error; // Re-throw the error for the caller to handle
         }
    }

    /**
     * Starts a specific Box by its ID.
     * Corresponds to the old startBox.
     */
    async startBox(id: string, signal?: AbortSignal): Promise<void> {
        this.logger?.debug(`Starting box with ID: ${id}`);
        try {
            const box = await this.boxManager.get(id);
            // FIX: Box model's start() method takes no arguments. Signal not handled here.
            await box.start();
            this.logger?.debug(`Box ${id} started successfully.`);
        } catch (error) {
            this.logger?.error(`Error starting box ${id}:`, error);
            throw error;
        }
    }

    /**
     * Creates a new Box instance using default command.
     * Corresponds to the private createBox in the old SDK.
     * Note: The new SDK handles creation via BoxManager.create.
     */
    private async createBox(
        image: string,
        options: {
          sessionId?: string;
          signal?: AbortSignal;
        }
      ): Promise<Box> {
        this.logger?.debug(`Creating box with image: ${image}, options: ${JSON.stringify(options)}`);

        // FIX: Split defaultCmd into cmd (string) and args (string[]) for BoxCreateOptions
        const [cmdString, ...argsArray] = this.defaultCmd;

        const createOptions: BoxCreateOptions = {
          image: image,
          cmd: cmdString,
          args: argsArray,
          labels: options.sessionId ? { sessionId: options.sessionId } : undefined,
        };
        try {
            const newBox = await this.boxManager.create(createOptions);
            this.logger?.debug(`Box created successfully: ${newBox.id}`);
            return newBox; // Return the Box instance
        } catch(error) {
            this.logger?.error('Error creating box:', error);
            throw error;
        }
    }

    /**
     * Helper method to wait for a box to reach 'running' state.
     */
    private async _waitForBoxReady(boxId: string, timeoutSeconds?: number): Promise<void> {
        const effectiveTimeout = (timeoutSeconds ?? this.defaultWaitTimeoutSeconds) * 1000; // milliseconds
        const pollInterval = 2000; // Check every 2 seconds
        const startTime = Date.now();

        this.logger?.debug(`Waiting for box ${boxId} to be ready (timeout: ${effectiveTimeout / 1000}s)...`);

        return new Promise((resolve, reject) => {
            const checkStatus = async () => {
                if (Date.now() - startTime > effectiveTimeout) {
                    this.logger?.error(`Timeout waiting for box ${boxId} to become ready.`);
                    return reject(new Error(`Timeout waiting for box ${boxId} to become ready`));
                }

                try {
                    const box = await this.getBox(boxId); // Use getBox to handle potential not found errors during wait
                    this.logger?.debug(`Box ${boxId} current status: ${box.status}`);
                    if (box.status === 'running') {
                        this.logger?.debug(`Box ${boxId} is ready.`);
                        return resolve();
                    } else if (['stopped', 'error', 'deleted', 'exited'].includes(box.status)) {
                        // Box entered a terminal state unexpectedly
                        this.logger?.error(`Box ${boxId} entered terminal state '${box.status}' while waiting to be ready.`);
                        return reject(new Error(`Box ${boxId} entered terminal state '${box.status}' while waiting`));
                    } else {
                        // Still creating or starting, poll again
                        setTimeout(checkStatus, pollInterval);
                    }
                } catch (error: unknown) {
                    // If getBox fails (e.g., NotFoundError), reject
                    this.logger?.error(`Error checking status for box ${boxId}:`, error);
                    // Propagate specific errors if needed
                    if (error instanceof NotFoundError) {
                         return reject(new Error(`Box ${boxId} not found while waiting for ready status.`));
                    }
                    return reject(error);
                }
            };
            // Initial check
            setTimeout(checkStatus, 0);
        });
    }

    /**
     * Gets an existing Box or creates a new one based on the provided options.
     * Corresponds to the old getOrCreateBox.
     */
    async getOrCreateBox(options: {
        boxId?: string;
        image?: string; // Image is needed if creating
        sessionId?: string;
        signal?: AbortSignal;
        waitTimeoutSeconds?: number; // Add timeout option for waiting
    }): Promise<string> { // Returns Box ID
        this.logger?.debug(`Getting or creating box with options: ${JSON.stringify(options)}`);
        const { boxId, image, sessionId, signal, waitTimeoutSeconds } = options;

        // 1. If boxId is provided, try to get it
        if (boxId) {
            try {
                const box = await this.getBox(boxId, { sessionId, signal });
                if (box.status === 'stopped') {
                    this.logger?.debug(`Box ${boxId} is stopped, starting...`);
                    await this.startBox(boxId);
                    // FIX: Wait for the box to be ready after starting
                    await this._waitForBoxReady(boxId, waitTimeoutSeconds);
                    this.logger?.debug(`Started and waited for box ${boxId}.`);
                }
                this.logger?.debug(`Found existing box by ID: ${boxId}`);
                return boxId;
            } catch (error: unknown) {
                 // FIX: Use imported NotFoundError and check message for session mismatch
                 if (error instanceof NotFoundError || (error instanceof Error && error.message.includes('does not belong to session'))) {
                     this.logger?.debug(`Box with ID ${boxId} not found or session mismatch, proceeding...`);
                 } else {
                    this.logger?.error(`Error getting box ${boxId}:`, error);
                    throw error; // Re-throw unexpected errors
                 }
            }
        }

        // 2. Try to reuse an existing box with matching image and session
        const effectiveImage = image || this.defaultImage;
        const listOptions = { sessionId, signal };
        const { boxes } = await this.getBoxes(listOptions);

        const runningBox = boxes.find(
            (box) => box.image === effectiveImage && box.status === 'running'
        );
        if (runningBox) {
            this.logger?.debug(`Reusing running box: ${runningBox.id}`);
            return runningBox.id;
        }

        const stoppedBox = boxes.find(
            (box) => box.image === effectiveImage && box.status === 'stopped'
        );
        if (stoppedBox) {
            this.logger?.debug(`Found stopped box ${stoppedBox.id}, starting...`);
            await this.startBox(stoppedBox.id);
            // FIX: Wait for the box to be ready after starting
            await this._waitForBoxReady(stoppedBox.id, waitTimeoutSeconds);
            this.logger?.debug(`Reusing started and waited for box: ${stoppedBox.id}`);
            return stoppedBox.id;
        }

        // 3. Create a new box if no suitable one is found
        this.logger?.debug(`No suitable existing box found. Creating new box with image ${effectiveImage}...`);
        const newBox = await this.createBox(effectiveImage, {
            sessionId,
            signal,
        });
        // FIX: Wait for the newly created box to be ready
        await this._waitForBoxReady(newBox.id, waitTimeoutSeconds);
        this.logger?.debug(`Created and waited for new box: ${newBox.id}`);
        return newBox.id;
    }

     /**
     * Runs a command inside a specific Box.
     * Corresponds to the old runInBox.
     * NOTE: Uses Box model's simple run(cmd: string[]), ignoring stdin/limit/signal options.
     */
    async runInBox(
        id: string,
        command: string | string[],
        stdin: string = "", // Stdin currently ignored by box.run
        options: {
            signal?: AbortSignal; // Signal currently ignored by box.run
            stdoutLineLimit?: number; // Limits currently ignored by box.run
            stderrLineLimit?: number;
        } = {}
     // FIX: Use BoxRunResponse as the return type
    ): Promise<BoxRunResponse> {
        this.logger?.debug(`Running command in box ${id}: ${JSON.stringify(command)}`);
        try {
            const box = await this.getBox(id, { signal: options.signal });

            let cmdArray: string[];
            if (Array.isArray(command)) {
                 cmdArray = command;
             } else {
                 cmdArray = command.split(' ');
             }

             // Call box.run with string[] as per models/box.ts definition
             const result = await box.run(cmdArray); // This now matches the Box model

            this.logger?.debug(`Command in box ${id} finished with exit code: ${result.exitCode}`);
             // FIX: Return type is BoxRunResponse, no need for assertion if BoxRunResult was meant to be this
            return result;
        } catch (error) {
            this.logger?.error(`Error running command in box ${id}:`, error);
            throw error;
        }
    }

    // Add other methods as needed, potentially mapping directly
    // to BoxManager methods like deleteAll, reclaim, or methods on Box instances.
}

// Example of how the service might be instantiated and used (optional)
// const loggerInstance = console; // Replace with your actual logger
// const boxService = new BoxService(loggerInstance);
// boxService.getOrCreateBox({ image: 'python:3.11-slim', sessionId: 'my-session-123' })
//   .then(boxId => {
//     console.log(`Got or created box: ${boxId}`);
//     // Note: stdin would be ignored in the current BoxService.runInBox implementation
//     return boxService.runInBox(boxId, ['python', '-c', 'print("Hello from Box!")']);
//   })
//   .then(result => {
//     console.log('Run result:', result.stdout);
//   })
//   .catch(error => {
//     console.error('Box service error:', error);
//   });
