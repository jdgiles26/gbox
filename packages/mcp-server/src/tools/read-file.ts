import { withLogging } from "../utils.js";
import { config } from "../config.js";
import { Gbox } from "../gboxsdk/index.js";
import { z } from "zod";
import type { Logger } from '../mcp-logger.js';

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

// Read file handler
export const handleReadFile = withLogging(
  async (logger: Logger, { path, boxId }, { signal }) => {
    logger.info(`Reading file: ${path}${boxId ? ` from box: ${boxId}` : ""}`);

    // TODO: should check file meta, if file not changed, should not copy it
    // Copy the file from sandbox to the share directory
    const gbox = new Gbox();
    const file = await gbox.files.readFile(boxId, path, { signal });

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
      content: ${file.content}
      `
    );

    return {
      content: [
        {
          type: "text" as const,
          text: file.content,
        },
      ],
    };
  }
);
