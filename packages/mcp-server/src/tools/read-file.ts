import { withLogging } from "../utils.js";
import { config } from "../config.js";
import { Gbox } from "../service/index.js";
import { z } from "zod";
import { GBoxFile, Logger, FILE_SIZE_LIMITS } from "../service/gbox.instance.js";

export const READ_FILE_TOOL = "read-file";
export const READ_FILE_DESCRIPTION = `Read a file from the API server.
If the file is a small text file (less than 1MB), the content will be returned directly.
If the file is a small image or audio file (less than 5MB), the content will be returned as base64 encoded data.
For large files or unsupported types, a resource URL will be returned with file metadata.
The path must start with / and requires a boxId to specify which box to read from.`;

export const readFileParams = {
  path: z
    .string()
    .describe(`The path to the file in the share directory. Must start with /`),
  boxId: z.string().describe(`The ID of the box to read the file from.`),
};

// Helper function to handle file content based on type and size
async function handleFileContent(
  file: GBoxFile,
  signal: AbortSignal,
  logger: Logger
) {
  // For directories, return error
  if (file.type === "dir") {
    return {
      content: [
        {
          type: "text" as const,
          text: "Cannot read directory content",
        },
      ],
      isError: true,
    };
  }

  // For small text files (less than 1MB), return content directly
  if (file.mime?.startsWith("text/") && file.size < FILE_SIZE_LIMITS.TEXT) {
    const text = await file.readText();
    return {
      content: [
        {
          type: "text" as const,
          text: text || "",
        },
      ],
    };
  }

  // For small images (less than 5MB), return base64 encoded content
  if (
    file.mime?.startsWith("image/") &&
    file.size < FILE_SIZE_LIMITS.BINARY
  ) {
    logger.info(`Reading image file: ${file.path}`);
    const buffer = await file.read();
    if (!buffer) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Failed to read image file",
          },
        ],
        isError: true,
      };
    }
    const base64 = Buffer.from(buffer).toString("base64");
    logger.info("base64: ", base64);
    return {
      content: [
        {
          type: "image" as const,
          data: base64,
          mimeType: file.mime!,
        },
      ],
    };
  }

  // For small audio files (less than 5MB), return base64 encoded content
  if (
    file.mime?.startsWith("audio/") &&
    file.size < FILE_SIZE_LIMITS.BINARY
  ) {
    const buffer = await file.read();
    if (!buffer) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Failed to read audio file",
          },
        ],
        isError: true,
      };
    }
    const base64 = Buffer.from(buffer).toString("base64");
    return {
      content: [
        {
          type: "audio" as const,
          data: base64,
          mimeType: file.mime!,
        },
      ],
    };
  }

  // For large files or unsupported types, return resource URI
  return {
    content: [
      {
        type: "text" as const,
        text: `${config.apiServer.url}/files/${file.path}`,
      },
    ],
  };
}

// Read file handler
export const handleReadFile = withLogging(
  async (logger: Logger, { path, boxId }, { signal }) => {
    logger.info(`Reading file: ${path}${boxId ? ` from box: ${boxId}` : ""}`);

    // TODO: should check file meta, if file not changed, should not copy it
    // Copy the file from sandbox to the share directory
    const gbox = new Gbox();
    const file = await gbox.files.shareFile(path, boxId, signal);

    if (!file) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Failed to read file",
          },
        ],
        isError: true,
      };
    }

    logger.info(
      `File shared successfully: 
      attrs: ${JSON.stringify(file.attrs, null, 2)}
      mimeType: ${file.mime}
      size: ${file.size}
      `
    );

    return handleFileContent(
      file,
      signal,
      logger
    );
  }
);
