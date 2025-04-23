import { FileApi } from '../api/file.api.ts';
// Use import type for interfaces/types
import type { FileInfo } from '../types/file.ts';
import { NotFoundError } from '../errors.ts';

/**
 * Represents a file or directory within the GBox shared volume.
 *
 * Provides methods to read content (for files) and access metadata via getters.
 * Attributes are stored in the `attrs` property and can be refreshed using `reload()`.
 */
export class GBoxFile {
  // Keep path separate as it's the identifier used for API calls
  readonly path: string;
  // Store the validated metadata
  public attrs: FileInfo;

  private fileApi: FileApi;

  // Constructor now accepts path and the FileInfo object as attrs
  constructor(path: string, fileInfo: FileInfo, fileApi: FileApi) {
    // Ensure the provided fileInfo has a path, or assign the lookup path
    // The path used for API calls (this.path) might differ slightly from attrs.path
    // (e.g., leading slash, normalization)
    this.path = path;
    this.attrs = { ...fileInfo, path: fileInfo.path ?? path }; // Store validated attrs

    this.fileApi = fileApi;
  }

  // --- Getters mimicking Python @property --- 

  get name(): string {
    return this.attrs.name;
  }

  get size(): number {
    return this.attrs.size;
  }

  get mode(): string {
    return this.attrs.mode;
  }

  get modTime(): string {
    return this.attrs.modTime;
  }

  get type(): 'file' | 'dir' | 'link' | undefined {
    return this.attrs.type;
  }

  get mime(): string | undefined {
    return this.attrs.mime;
  }

  get isDir(): boolean {
    // Derive from type, matching Python's logic
    return this.attrs.type === 'dir';
  }

  // --- Instance Methods --- 

  /**
   * Reads the content of the file as an ArrayBuffer.
   */
  async read(): Promise<ArrayBuffer> {
    if (this.isDir) { // Use the getter
      throw new Error(`Cannot read content of a directory: ${this.path}`);
    }
    // Use the stored path for the API call
    return this.fileApi.getContent(this.path);
  }

  /**
   * Reads the content of the file as a UTF-8 string.
   */
  async readText(encoding: string = 'utf-8'): Promise<string> {
     const buffer = await this.read();
     const decoder = new TextDecoder(encoding);
     return decoder.decode(buffer);
  }

  /**
   * Reloads the file's metadata from the API and updates the `attrs` property.
   */
  async reload(): Promise<void> {
    // Use the stored path for the API call
    const updatedInfo = await this.fileApi.getStat(this.path);
    if (updatedInfo) {
        // Update the attrs property with the new validated data
        this.attrs = updatedInfo;
    } else {
        // Consider the file gone, throw NotFoundError consistent with get
        throw new NotFoundError(`Failed to reload metadata for file: ${this.path}. File may not exist.`);
    }
  }

  // Override toString for better representation
  toString(): string {
    return `GBoxFile(path='${this.path}', type='${this.attrs.type ?? 'unknown'}')`;
  }

  // Implement equals based on path?
  equals(other: unknown): boolean {
      if (other instanceof GBoxFile) {
          return this.path === other.path;
      }
      return false;
  }

  // Potential future methods:
  // async delete(): Promise<void> { /* Requires API support */ }
  // async rename(newPath: string): Promise<void> { /* Requires API support */ }
  // async listDir(): Promise<GBoxFile[]> { /* If API supports listing directory content */ }
} 