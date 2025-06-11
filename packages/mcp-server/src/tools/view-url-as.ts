import { z } from "zod";// Import type guard if needed
import { withLogging } from "../utils.js"; // Added import
import { config } from "../config.js"; // Added import
import type { Logger } from '../mcp-logger.js';

// Define the Zod schema for the tool's parameters, including name and description
export const ViewUrlAsSchema = z.object({
  name: z.literal("view-url-as"),
  description: z
    .string()
    .default(
      "Fetch and view content from a URL as HTML, Markdown, or screenshot. Optionally specify a boxId to reuse a specific browser session."
    )
    .describe(
      // Using .describe() for a potentially longer description if needed elsewhere
      "Navigates to a URL in a browser context and returns its content as HTML, Markdown, or takes a screenshot. Use the boxId parameter to maintain session state across calls."
    ),
  parameters: z.object({
    url: z.string().url({
      message:
        "The URL to fetch content from (must start with http:// or https://).",
    }),
    as: z.enum(["html", "markdown", "screenshot"], {
      errorMap: () => ({
        message:
          "The desired output format: 'html', 'markdown', or 'screenshot'.",
      }),
    }),
    boxId: z.preprocess(
      // Preprocess to handle null input
      (val) => (val === null ? undefined : val),
      z.string().optional() // Keep the original validation
    ) // Added boxId
      .describe(`The ID of an existing browser box to use.
        If not provided, the system will try to reuse an existing box with a browser image.
        The system will first try to use a running box, then a stopped box (which will be started), and finally create a new one if needed.
        Note that without boxId, multiple calls may use different boxes even if they exist.
        If you need to ensure multiple calls use the same box, you must provide a boxId.
        You can get the list of existing boxes by using the list-boxes tool.
        `),
  }),
});

// Derive constants from the schema
export const VIEW_URL_AS_TOOL = ViewUrlAsSchema.shape.name.value;
export const VIEW_URL_AS_DESCRIPTION =
  ViewUrlAsSchema.shape.description._def.defaultValue(); // Get the default value
export const viewUrlAsParams = ViewUrlAsSchema.shape.parameters.shape; // Use .shape to get the raw shape for McpServer.tool

// Define the expected content structure(s)
type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: string };
type ErrorContent = { type: "error"; text: string };
type ResultContent = TextContent | ImageContent | ErrorContent;

// Infer the type for the parameters object from the schema
type ViewUrlAsParams = z.infer<typeof ViewUrlAsSchema.shape.parameters>;

// Define the internal action function for the tool
async function _handleViewUrlAs(
  logger: Logger, // Logger comes first from withLogging
  { url, as, boxId }: ViewUrlAsParams, // Destructure params
  { signal, sessionId }: { signal: AbortSignal; sessionId?: string }
): Promise<{ content: Array<ResultContent> }> {
  return {
    content: [
      {
        type: "text",
        text: "Not implemented",
      },
    ],
  }
}

// Export the wrapped function
export const handleViewUrlAs = withLogging(_handleViewUrlAs);

