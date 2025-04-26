import { Client } from './http-client.ts'; // Add .ts
import type {
  FileInfo,
  FileReclaimApiResponse,
  FileShareApiResponse,
  FileWriteApiResponse,
} from '../types/file.ts'; // Use import type
import { NotFoundError } from '../errors.ts'; // Add .ts

const API_PREFIX = '/api/v1/files'; // Base path for file operations

export class FileApi extends Client {
  // Ensures path starts with / as expected by Python API implementation
  private normalizePath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
  }

  /**
   * Get metadata of a file or directory via HEAD request.
   * Parses the 'X-Gbox-File-Stat' header.
   * Maps to HEAD /api/v1/files/{path}
   */
  async getStat(path: string, signal?: AbortSignal): Promise<FileInfo | null> {
    const normalizedPath = this.normalizePath(path);
    try {
      const headers = await super.head(
        `${API_PREFIX}${normalizedPath}`,
        undefined,
        undefined,
        signal
      );
      const statHeader = headers['x-gbox-file-stat']; // Headers are lowercased by helper
      if (statHeader) {
        try {
          const fileInfo = JSON.parse(statHeader) as FileInfo;
          fileInfo.path = path; // Add original path for context
          // Determine isDir based on type or mode if needed
          fileInfo.isDir = fileInfo.type === 'dir'; // Example based on type field
          return fileInfo;
        } catch (e) {
          console.error(
            `[GBox SDK] Failed to parse x-gbox-file-stat header for path ${path}: ${e}`
          );
          // Decide how to handle parse error: return null, throw specific error?
          return null;
        }
      }
      return null; // Header not found
    } catch (error) {
      // HEAD returning 404 should be caught by Client.handleError and throw NotFoundError
      // If we want head to return null on 404 like Python might imply, catch specific error
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error; // Re-throw other errors
    }
  }

  /**
   * Get the content of a file.
   * Maps to GET /api/v1/files/{path}
   */
  async getContent(path: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const normalizedPath = this.normalizePath(path);
    // Use Client.getRaw
    return super.getRaw(
      `${API_PREFIX}${normalizedPath}`,
      undefined,
      { Accept: '*/*' },
      signal
    );
  }

  /**
   * Reclaim unused files.
   * Maps to POST /api/v1/files with operation=reclaim in body
   */
  async reclaim(signal?: AbortSignal): Promise<FileReclaimApiResponse> {
    const data = { operation: 'reclaim' };
    // Use Client.post
    return super.post<FileReclaimApiResponse>(
      `${API_PREFIX}`,
      data,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Share a file/directory from a box's shared volume.
   * Maps to POST /api/v1/files with operation=share in body
   */
  async share(
    boxId: string,
    path: string,
    signal?: AbortSignal
  ): Promise<FileShareApiResponse> {
    const normalizedPath = this.normalizePath(path);
    const data = { boxId: boxId, path: normalizedPath, operation: 'share' };
    // Use Client.post
    return super.post<FileShareApiResponse>(
      `${API_PREFIX}`,
      data,
      undefined,
      undefined,
      signal
    );
  }

  /**
   * Write content to a file in a box's shared volume.
   * Maps to POST /api/v1/files with operation=write in body
   */
  async write(
    boxId: string,
    path: string,
    content: string,
    signal?: AbortSignal
  ): Promise<FileWriteApiResponse> {
    const normalizedPath = this.normalizePath(path);
    const data = {
      boxId: boxId,
      path: normalizedPath,
      content: content,
      operation: 'write',
    };
    // Use Client.post
    return super.post<FileWriteApiResponse>(
      `${API_PREFIX}`,
      data,
      undefined,
      undefined,
      signal
    );
  }
}
