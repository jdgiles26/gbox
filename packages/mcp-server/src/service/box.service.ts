import { 
    Box, 
    BoxBrowserManager, 
    NotFoundError, 
    type BoxRunResponse, 
    type BoxRunOptions, 
    type BoxListFilters, 
    type BoxCreateOptions 
} from './gbox.instance.js';

import { gbox } from './gbox.instance.js';

export class BoxService {
    private readonly defaultImage = 'babelcloud/gbox-playwright';
    private readonly defaultCmd = ["sleep", "infinity"];
    private readonly defaultWaitTimeoutSeconds = 120;

    /**
     * Retrieves a list of Boxes, optionally filtered by sessionId or specific boxId.
     */
    async getBoxes(options: { sessionId?: string; boxId?: string; signal?: AbortSignal }): Promise<{ boxes: Box[]; count: number }> {
        try {
            let boxes: Box[];
            if (options.boxId) {
                try {
                    const box = await gbox.boxes.get(options.boxId, options.signal);
                    boxes = [box];
                } catch (error: unknown) {
                    if (error instanceof NotFoundError) {
                        boxes = [];
                    } else {
                        throw error;
                    }
                }
            } else {
                let filters: BoxListFilters | undefined;
                if (options.sessionId) {
                    filters = { label: [`sessionId=${options.sessionId}`] };
                }
                boxes = await gbox.boxes.list(filters, options.signal);
            }

            return { boxes, count: boxes.length };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Gets a specific Box by its ID.
     * Corresponds to the old getBox.
     */
    async getBox(id: string, options?: { signal?: AbortSignal; sessionId?: string }): Promise<Box> {
        try {
            const box = await gbox.boxes.get(id, options?.signal);
            if (options?.sessionId && box.labels?.sessionId !== options.sessionId) {
                throw new Error(`Box ${id} found but does not belong to session ${options.sessionId}`);
            }
            return box;
        } catch (error: unknown) {
            if (error instanceof NotFoundError || (error instanceof Error && error.message.includes('does not belong to session'))) {
            } else {
            }
            throw error;
        }
    }

    /**
     * Starts a specific Box by its ID.
     * Corresponds to the old startBox.
     */
    async startBox(id: string, signal?: AbortSignal): Promise<void> {
        try {
            const box = await gbox.boxes.get(id, signal);
            await box.start(signal);
        } catch (error) {
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
        const [cmdString, ...argsArray] = this.defaultCmd;

        const createOptions: BoxCreateOptions = {
          image: image,
          cmd: cmdString,
          args: argsArray,
          labels: options.sessionId ? { sessionId: options.sessionId } : undefined,
        };
        try {
            const newBox = await gbox.boxes.create(createOptions, options.signal);
            return newBox;
        } catch(error) {
            throw error;
        }
    }

    /**
     * Helper method to wait for a box to reach 'running' state.
     */
    private async _waitForBoxReady(boxId: string, timeoutSeconds?: number): Promise<void> {
        const effectiveTimeout = (timeoutSeconds ?? this.defaultWaitTimeoutSeconds) * 1000;
        const pollInterval = 2000;
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const checkStatus = async () => {
                if (Date.now() - startTime > effectiveTimeout) {
                    return reject(new Error(`Timeout waiting for box ${boxId} to become ready`));
                }

                try {
                    const box = await this.getBox(boxId);
                    if (box.status === 'running') {
                        return resolve();
                    } else if (['stopped', 'error', 'deleted', 'exited'].includes(box.status)) {
                        return reject(new Error(`Box ${boxId} entered terminal state '${box.status}' while waiting`));
                    } else {
                        setTimeout(checkStatus, pollInterval);
                    }
                } catch (error: unknown) {
                    if (error instanceof NotFoundError) {
                         return reject(new Error(`Box ${boxId} not found while waiting for ready status.`));
                    }
                    return reject(error);
                }
            };
            setTimeout(checkStatus, 0);
        });
    }

    /**
     * Gets an existing Box or creates a new one based on the provided options.
     * Corresponds to the old getOrCreateBox.
     */
    async getOrCreateBox(options: {
        boxId?: string;
        image?: string;
        sessionId?: string;
        signal?: AbortSignal;
        waitTimeoutSeconds?: number;
    }): Promise<string> {
        const { boxId, image, sessionId, signal, waitTimeoutSeconds } = options;

        if (boxId) {
            try {
                const box = await this.getBox(boxId, { sessionId, signal });
                if (box.status === 'stopped') {
                    await this.startBox(boxId, signal);
                    await this._waitForBoxReady(boxId, waitTimeoutSeconds);
                }
                return boxId;
            } catch (error: unknown) {
                 if (error instanceof NotFoundError || (error instanceof Error && error.message.includes('does not belong to session'))) {
                 } else {
                    throw error;
                 }
            }
        }

        const effectiveImage = image || this.defaultImage;
        const listOptions = { sessionId, signal };
        const { boxes } = await this.getBoxes(listOptions);

        const runningBox = boxes.find(
            (box) => box.image.split(':')[0] === effectiveImage && box.status === 'running'
        );
        if (runningBox) {
            return runningBox.id;
        }

        const stoppedBox = boxes.find(
            (box) => box.image.split(':')[0] === effectiveImage && box.status === 'stopped'
        );
        if (stoppedBox) {
            await this.startBox(stoppedBox.id, signal);
            await this._waitForBoxReady(stoppedBox.id, waitTimeoutSeconds);
            return stoppedBox.id;
        }

        const newBox = await this.createBox(effectiveImage, {
            sessionId,
            signal,
        });
        await this._waitForBoxReady(newBox.id, waitTimeoutSeconds);
        return newBox.id;
    }

    /**
     * Initializes the browser manager for a specific Box.
     * This provides access to browser context and page operations via the SDK's manager.
     * @param boxId The ID of the Box.
     * @returns A Promise resolving to a BoxBrowserManager instance.
     */
    async initBrowser(boxId: string, signal?: AbortSignal): Promise<BoxBrowserManager> {
        try {
            const box = await gbox.boxes.get(boxId, signal);
            const browserManager = box.initBrowser();
            return browserManager;
        } catch (error) {
            throw error;
        }
    }

     /**
     * Runs a command inside a specific Box.
     * Corresponds to the old runInBox.
     * NOTE: Uses Box model's simple run(cmd: string[]), ignoring stdin/limit/signal options.
     */
    async runInBox(
        id: string,
        command: string | string[],
        stdin: string,
        stdoutLineLimit: number,
        stderrLineLimit: number,
        context: {
            signal?: AbortSignal;
            sessionId?: string;
        } = {}
    ): Promise<BoxRunResponse> {
        try {
            const box = await gbox.boxes.get(id, context.signal);

            let cmdArray: string[];
            if (Array.isArray(command)) {
                 cmdArray = command;
             } else {
                 cmdArray = command.split(' ');
             }

             const runOptions: BoxRunOptions = {
                 stdin: stdin,
                 signal: context?.signal,
                 stdoutLineLimit: stdoutLineLimit,
                 stderrLineLimit: stderrLineLimit,
             };

             const result = await box.run(cmdArray, runOptions, context.signal);

            return result;
        } catch (error) {
            throw error;
        }
    }
}
