import { FileApi } from '../api/file.api.ts';
import { GBoxFile } from '../models/file.ts';
// Use import type for interfaces/types
import type {
    FileReclaimApiResponse,
    FileShareApiResponse,
    FileInfo // FileInfo is used in GBoxFile signature, still type-only here
} from '../types/file.ts';
import { NotFoundError, APIError } from '../errors.ts'; // Errors are classes (runtime values)
// Import File related types when defined
// import { FileInfo, SharedFileParams } from '../types/file';

// Helper function for basename (simple implementation)
function basename(path: string): string {
    return path.split('/').filter(Boolean).pop() || '';
}

export class FileManager {
  private fileApi: FileApi;

  constructor(fileApi: FileApi) {
    this.fileApi = fileApi;
  }

  /**
   * Retrieves metadata for a file or directory in the shared volume.
   *
   * @param path The absolute path in the shared volume (e.g., "/shared/data/my_file.txt").
   * @returns A promise resolving to a GBoxFile instance with the metadata.
   * @throws {NotFoundError} If the path does not exist.
   * @throws {APIError} For other API errors.
   */
  async get(path: string): Promise<GBoxFile> {
    const fileInfo = await this.fileApi.getStat(path);
    if (!fileInfo) {
        throw new NotFoundError(`File or directory not found at path: ${path}`);
    }
    // Pass the original path, fetched fileInfo, and fileApi to the constructor
    return new GBoxFile(path, fileInfo, this.fileApi);
  }

  /**
   * Checks if a file or directory exists at the given path in the shared volume.
   *
   * @param path The absolute path in the shared volume.
   * @returns A promise resolving to true if the path exists, false otherwise.
   * @throws {APIError} For errors other than NotFound.
   */
  async exists(path: string): Promise<boolean> {
    try {
        const fileInfo = await this.fileApi.getStat(path);
        return fileInfo !== null;
    } catch (error) {
        if (error instanceof NotFoundError) {
            return false; // Explicitly doesn't exist
        } else if (error instanceof APIError) {
            // Log other API errors but return false, similar to Python's behavior
            console.warn(`[GBox SDK] API error checking existence for '${path}', assuming not found: ${error.message}`);
            return false;
        } else {
            // Re-throw unexpected non-API errors
             console.error(`[GBox SDK] Unexpected error checking existence for '${path}':`, error);
            throw error;
        }
    }
  }

  /**
   * Reads the content of a file from the shared volume as an ArrayBuffer.
   *
   * @param path The absolute path to the file in the shared volume.
   * @returns A promise resolving to the file content as an ArrayBuffer.
   * @throws {NotFoundError} If the file does not exist or is a directory.
   * @throws {APIError} For other errors.
   */
  async read(path: string): Promise<ArrayBuffer> {
    return this.fileApi.getContent(path);
  }

  /**
   * Reads the content of a file from the shared volume as a string.
   *
   * @param path The absolute path to the file in the shared volume.
   * @param encoding The text encoding to use (default: 'utf-8').
   * @returns A promise resolving to the file content as a string.
   * @throws {NotFoundError} If the file does not exist or is a directory.
   * @throws {APIError} For other errors.
   */
  async readText(path: string, encoding: string = 'utf-8'): Promise<string> {
    const buffer = await this.read(path);
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  }

  /**
   * Shares a file from a specified box into the shared volume.
   *
   * @param boxId The ID of the source Box.
   * @param path The path to the file/directory within the box's shared volume (relative to /var/gbox/share).
   * @returns A promise resolving to the GBoxFile instance representing the shared file in the main volume.
   * @throws {APIError} If the sharing operation fails or the response is invalid.
   * @throws {Error} If the API response doesn't contain expected file info.
   */
  async share(boxId: string, path: string): Promise<GBoxFile> {
    const response = await this.fileApi.share(boxId, path);

    // Validate response (basic checks, can be enhanced with Zod)
    if (!response.success) {
      throw new APIError(`File sharing failed: ${response.message || 'Unknown reason'}`, undefined, response);
    }

    if (!response.fileList || response.fileList.length === 0) {
      throw new Error('File sharing succeeded according to API, but no file information was returned.');
    }

    // --- Path Reconstruction (similar to Python SDK) ---
    // Use the filename from the *original* path parameter passed to the share function.
    const originalFilename = basename(path);
    if (!originalFilename) {
        throw new Error(`Could not determine filename from original path: ${path}`);
    }
    // Construct the expected path in the main shared volume
    const reconstructedPath = `/${boxId}/${originalFilename}`;

    console.info(`[GBox SDK] Reconstructed shared file path: ${reconstructedPath}`);

    // Now, get the GBoxFile using the reconstructed path
    try {
        return await this.get(reconstructedPath);
    } catch (error) {
        // Log the error and re-throw or wrap it
        console.error(`[GBox SDK] Failed to get shared file using reconstructed path '${reconstructedPath}' after successful share operation:`, error);
        if (error instanceof Error) {
             throw new APIError(`Failed to retrieve shared file info at expected path '${reconstructedPath}' after share: ${error.message}`, undefined, response);
        } else {
            throw new APIError(`Failed to retrieve shared file info at expected path '${reconstructedPath}' after share.`, undefined, response);
        }
    }
  }

  /**
   * Reclaims unused files in the shared volume.
   *
   * @returns A promise resolving to the reclamation result details.
   * @throws {APIError} If the reclamation operation fails.
   */
  async reclaim(): Promise<FileReclaimApiResponse> {
    // TODO: Add Pydantic-like validation for the response if needed
    return this.fileApi.reclaim();
  }

  // Potential future methods:
  // async list(path: string): Promise<GBoxFile[]> { /* If API supports listing */ }
  // async createDir(path: string): Promise<GBoxFile> { /* Requires API support */ }
  // async writeFile(path: string, content: string | ArrayBuffer): Promise<GBoxFile> { /* Requires API support */ }
  // async delete(path: string): Promise<void> { /* Requires API support */ }
} 