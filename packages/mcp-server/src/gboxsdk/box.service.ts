import { gbox, gboxClient, NotFoundError } from './gbox.instance.js';
import { CreateLinux, LinuxBoxOperator } from 'gbox-sdk/wrapper/box/linux';
import { BoxRunCodeParams, BoxRunCodeResponse } from 'gbox-sdk/resources/v1/boxes';

export class BoxService {
    private readonly defaultImage = 'babelcloud/gbox-playwright';
    private readonly defaultWaitTimeoutSeconds = 120;

    async getBoxes(options: { sessionId?: string; boxId?: string; signal?: AbortSignal }): Promise<{ boxes: LinuxBoxOperator[]; count: number }> {
        try {
            let boxes: LinuxBoxOperator[];
            if (options.boxId) {
                try {
                    const box = await gbox.get(options.boxId);
                    boxes = [box] as LinuxBoxOperator[];
                } catch (error: unknown) {
                    if (error instanceof NotFoundError) {
                        boxes = [];
                    } else {
                        throw error;
                    }
                }
            } else {
                const boxListResult = await gbox.list() as LinuxBoxOperator[];
                boxes = boxListResult.filter(box => (box.config.labels as any)?.sessionId === options.sessionId);
            }
            return { boxes, count: boxes.length };
        } catch (error) {
            throw error;
        }
    }

    async getBox(id: string, options?: { signal?: AbortSignal; sessionId?: string }): Promise<LinuxBoxOperator> {
        try {
            const box = await gbox.get(id) as LinuxBoxOperator;
            if (options?.sessionId && (box.config.labels as any)?.sessionId !== options.sessionId) {
                throw new Error(`Box ${id} found but does not belong to session ${options.sessionId}`);
            }
            return box;
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw new Error(`Box ${id} not found`);
            } else {
                throw error;
            }
        }
    }

    async startBox(id: string, _signal?: AbortSignal): Promise<void> {
        try {
            const box = await gbox.get(id) as LinuxBoxOperator;
            await box.start();
        } catch (error) {
            throw error;
        }
    }

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

    async getOrCreateBox(options: {
        boxId?: string;
        sessionId?: string;
        signal?: AbortSignal;
        waitTimeoutSeconds?: number;
    }): Promise<{ boxId: string | null; imagePullStatus?: { inProgress: boolean; imageName: string; message: string } }> {
        const { boxId, sessionId, signal, waitTimeoutSeconds } = options;

        if (boxId) {
            try {
                const box = await this.getBox(boxId, { sessionId, signal });
                if (box.status === 'stopped') {
                    await this.startBox(boxId, signal);
                    await this._waitForBoxReady(boxId, waitTimeoutSeconds);
                }
                return { boxId };
            } catch (error: unknown) {
                 if (error instanceof NotFoundError || (error instanceof Error && error.message.includes('does not belong to session'))) {
                 } else {
                    throw error;
                 }
            }
        }

        /* image is not supported on ts sdk

        const effectiveImage = image || this.defaultImage;
        const listOptions = { sessionId, signal };
        const { boxes } = await this.getBoxes(listOptions);

        const runningBox = boxes.find(
            (box) => box.config.image.split(':')[0] === this.defaultImage && box.status === 'running'
        );
        if (runningBox) {
            return { boxId: runningBox.id };
        }

        const stoppedBox = boxes.find(
            (box) => box.image.split(':')[0] === effectiveImage && box.status === 'stopped'
        );
        if (stoppedBox) {
            await this.startBox(stoppedBox.id, signal);
            await this._waitForBoxReady(stoppedBox.id, waitTimeoutSeconds);
            return { boxId: stoppedBox.id };
        }
        */

        const boxes = await this.getBoxes({ sessionId, signal });
        const runningBox = boxes.boxes.find(box => box.status === 'running');
        if (runningBox) {
            return { boxId: runningBox.id };
        }
        
        const stoppedBox = boxes.boxes.find(box => box.status === 'stopped');
        if (stoppedBox) {
            await this.startBox(stoppedBox.id, signal);
            await this._waitForBoxReady(stoppedBox.id, waitTimeoutSeconds);
            return { boxId: stoppedBox.id };
        }

        // Create a new box with timeout
        const createOptions: CreateLinux = {
            type: 'linux',
            config: {
                expiresIn: "1000s",
                envs: { sessionId },
                labels: { sessionId },
            },
            timeout: '1000ms',
            wait: true,
        };

        // We need to use 'any' here because the SDK type system hasn't been updated
        // to reflect the new behavior of returning imagePullStatus
        try {
            const box = await gbox.create(createOptions);
            if (box.id) {
                await this._waitForBoxReady(box.id, waitTimeoutSeconds);
                return { boxId: box.id };
            } else {
                return { boxId: null };
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('ImagePullInProgress')) {
                return { boxId: null, imagePullStatus: { inProgress: true, imageName: this.defaultImage, message: error.message } };
            }
            throw error;
        }
    }

    async initBrowser(id: string, context: { signal?: AbortSignal; sessionId?: string } = {}) {
        //not immplemented yet
        return null;
    }

    async runInBox(id: string, language: string, code: string, context: { signal?: AbortSignal; sessionId?: string } = {}): Promise<BoxRunCodeResponse> {
        try {
            const box = await gbox.get(id);
            const runCodeParams: BoxRunCodeParams = {
                code,
                language: language as 'bash' | 'python3' | 'typescript',
            }
            const result = await box.runCode(
                runCodeParams
            );
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getBoxCdpUrl(id: string, context: { signal?: AbortSignal; sessionId?: string } = {}): Promise<string | null> {
        try {
            const cdpUrl = await gboxClient.v1.boxes.browser.cdpURL(id, {
                signal: context.signal,
            });
            return cdpUrl;
        } catch (error) {
            if (error instanceof NotFoundError) {
                return null;
            } else {
                throw error;
            }
        }
    }
}