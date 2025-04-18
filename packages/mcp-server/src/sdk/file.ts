import type {
  FileMetadataResponse,
  FileShareResponse,
  GBoxConfig,
  Logger,
} from "./types";
import { Client } from "./client";

interface FileOperationRequest {
  path: string;
  boxId: string;
  content?: string;
  operation: "share" | "write" | "reclaim";
}

export class FileService {
  private readonly client: Client;
  private readonly logger?: Logger;

  constructor(client: Client, config: GBoxConfig) {
    this.client = client;
    this.logger = config.logger;
  }

  // Get file metadata
  async getFileMetadata(
    path: string,
    signal?: AbortSignal
  ): Promise<FileMetadataResponse | null> {
    const response = await this.client.head(`/files/${path}`, { signal });
    if (!response.ok) {
      return null;
    }

    const fileStat = JSON.parse(
      response.headers.get("X-Gbox-File-Stat") || "{}"
    );
    const mimeType =
      response.headers.get("Content-Type") || "application/octet-stream";
    const contentLength = parseInt(
      response.headers.get("Content-Length") || "0",
      10
    );

    return {
      fileStat,
      mimeType,
      contentLength,
    };
  }

  // Share file from box
  async shareFile(
    path: string,
    boxId: string,
    signal?: AbortSignal
  ): Promise<FileShareResponse | null> {
    const request: FileOperationRequest = {
      path,
      boxId,
      operation: "share",
    };

    const response = await this.client.post("/files", {
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  // Read file content as text
  async readFileAsText(
    path: string,
    signal?: AbortSignal
  ): Promise<string | null> {
    const response = await this.client.get(`/files/${path}`, { signal });
    if (!response.ok) {
      return null;
    }

    return response.text();
  }

  // Read file content as array buffer
  async readFileAsBuffer(
    path: string,
    signal?: AbortSignal
  ): Promise<ArrayBuffer | null> {
    const response = await this.client.get(`/files/${path}`, { signal });
    if (!response.ok) {
      return null;
    }

    return response.arrayBuffer();
  }

  // Convert buffer to base64
  bufferToBase64(buffer: ArrayBuffer): string {
    return Buffer.from(buffer).toString("base64");
  }

  // Write file content
  async writeFile(
    boxId: string,
    path: string,
    content: string,
    signal?: AbortSignal
  ): Promise<FileShareResponse | null> {
    const request: FileOperationRequest = {
      path,
      boxId,
      content,
      operation: "write",
    };

    const response = await this.client.post(`/files`, {
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to write file: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
