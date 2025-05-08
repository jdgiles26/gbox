import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ListResourcesResult } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "./mcp-logger.js";

// Change LogFunction type to Logger interface
export type LogFunction = Logger;

export type WithLoggingHandler<T extends (...args: any[]) => any> = (
  logger: Logger,
  ...args: Parameters<T>
) => ReturnType<T>;

// Update wrapper function to accept and pass Logger
export function withLogging<T extends (...args: any[]) => any>(
  handler: WithLoggingHandler<T>
): (logger: Logger) => T {
  return (logger: Logger) => {
    return (async (...args: Parameters<T>) => {
      return await handler(logger, ...args);
    }) as T;
  };
}

// Resource template types
type ResourceTemplateCallback = ConstructorParameters<
  typeof ResourceTemplate
>[1];
type ListCallback = NonNullable<ResourceTemplateCallback["list"]>;

// Update wrapper function specifically for ResourceTemplate to use Logger
export function withLoggingResourceTemplate(
  uri: string,
  options: Omit<ResourceTemplateCallback, "list"> & {
    list: WithLoggingHandler<ListCallback>;
  }
): (logger: Logger) => ResourceTemplate {
  return (logger: Logger) => {
    // Create a new options object with wrapped list method passing logger
    const wrappedOptions = {
      ...options,
      list: async (extra: RequestHandlerExtra): Promise<ListResourcesResult> =>
        options.list(logger, extra),
    };

    // Create and return the ResourceTemplate instance
    return new ResourceTemplate(uri, wrappedOptions);
  };
}

// This file is intentionally empty as the snake_case to camelCase conversion
// is no longer needed since the API now uses camelCase by default.
