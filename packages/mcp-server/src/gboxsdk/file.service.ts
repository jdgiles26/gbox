import { gboxClient } from './gbox.instance.js';
import { FReadResponse, FWriteResponse } from 'gbox-sdk/resources/v1/boxes/fs.js';

export class FileService {
    async writeFile(boxId: string, path: string, content: string, context: { signal?: AbortSignal; sessionId?: string } = {}): Promise<FWriteResponse> {
        const result = await gboxClient.v1.boxes.fs.write(
            boxId,
            {
                path,
                content,
            },
            {
                signal: context.signal,
            }
        )
        return result;
    }

    async readFile(boxId: string, path: string, context: { signal?: AbortSignal; sessionId?: string } = {}): Promise<FReadResponse> {
        const result = await gboxClient.v1.boxes.fs.read(
            boxId,
            {
                path,
            },
            {
                signal: context.signal,
            }
        )
        return result;
    }
}