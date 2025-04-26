import { gbox, GBoxFile } from './gbox.instance.js';

export class FileService {
    /**
     * Shares a file from a box and retrieves its representation in the shared volume.
     */
    async getFileMetadata(path: string, signal?: AbortSignal): Promise<GBoxFile | null> {
        const exists = await gbox.files.exists(path, signal);
        if (!exists) {
            return null;
        }
        const file = await gbox.files.get(path, signal);
        return file;
    }

    /**
     * Shares a file from a box and retrieves its representation in the shared volume.
     */
    async shareFile(path: string, boxId: string, signal?: AbortSignal): Promise<GBoxFile | null> {
        const file = await gbox.files.share(boxId, path, signal);
        return file;
    }

    /**
     * Reads the content of a GBoxFile as text.
     */
    async readFileAsText(file: GBoxFile, signal?: AbortSignal): Promise<string | null> {
        const text = await file.readText(undefined, signal);
        return text;
    }

    /**
     * Reads the content of a GBoxFile as ArrayBuffer.
     */
    async readFileAsBuffer(file: GBoxFile, signal?: AbortSignal): Promise<ArrayBuffer | null> {
        const buffer = await file.read(signal);
        return buffer;
    }

    async writeFile(boxId: string, path: string, content: string, signal?: AbortSignal): Promise<GBoxFile | null> {
        const file = await gbox.files.write(boxId, path, content, signal);
        return file;
    }
}

