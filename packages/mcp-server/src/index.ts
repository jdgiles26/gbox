import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { boxTemplate, handleBoxResource } from "./resources.js";
import {
  RUN_PYTHON_TOOL,
  RUN_PYTHON_DESCRIPTION,
  RUN_BASH_TOOL,
  RUN_BASH_DESCRIPTION,
  READ_FILE_TOOL,
  READ_FILE_DESCRIPTION,
  WRITE_FILE_TOOL,
  WRITE_FILE_DESCRIPTION,
  handleRunPython,
  handleRunBash,
  handleReadFile,
  runPythonParams,
  runBashParams,
  readFileParams,
  handleWriteFile,
  writeFileParams,
} from "./tools/index.js";
import type { LoggingMessageNotification } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { LogFn } from "./types.js";

const enableLogging = true;

// Create MCP server instance
const mcpServer = new McpServer(
  {
    name: "gbox-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      prompts: {},
      resources: {},
      tools: {},
      ...(enableLogging ? { logging: {} } : {}),
    },
  }
);
const log: LogFn = async (
  params: LoggingMessageNotification["params"]
): Promise<void> => {
  if (enableLogging) {
    await mcpServer.server.sendLoggingMessage(params);
  }
};

// Register box resource
mcpServer.resource("box", boxTemplate(log), handleBoxResource(log));

const GBOX_MANUAL = "gbox-manual";
const GBOX_MANUAL_DESCRIPTION = "A manual for the gbox command line tool.";
const GBOX_MANUAL_CONTENT = `
# GBox Manual

## Overview
Gbox is a set of tools that allows you to complete various tasks. All the tools are executed in a sandboxed environment. Gbox is developed by Gru AI.

## Usage
### run-python
If you need to execute a standalone python script, you can use the run-python tool. 

### run-bash
If you need to execute a standalone bash script, you can use the run-bash tool. 

### read-file
If you need to read a file from the sandbox, you can use the read-file tool. 

### write-file
If you need to write a file to the sandbox, you can use the write-file tool. 
`

// Register gbox manual prompt
mcpServer.prompt(
  GBOX_MANUAL,
  GBOX_MANUAL_DESCRIPTION,
  (_: RequestHandlerExtra) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: GBOX_MANUAL_CONTENT
          },
        },
      ],
    };
  }
);

// Register tools

// This is meaningless for now, because we don't have a way to explicitly create a box.
// mcpServer.tool(
//   LIST_BOXES_TOOL,
//   LIST_BOXES_DESCRIPTION,
//   {},
//   handleListBoxes(log)
// );

mcpServer.tool(
  READ_FILE_TOOL,
  READ_FILE_DESCRIPTION,
  readFileParams,
  handleReadFile(log)
);

mcpServer.tool(
  WRITE_FILE_TOOL,
  WRITE_FILE_DESCRIPTION,
  writeFileParams,
  handleWriteFile(log)
);

mcpServer.tool(
  RUN_PYTHON_TOOL,
  RUN_PYTHON_DESCRIPTION,
  runPythonParams,
  handleRunPython(log)
);

mcpServer.tool(
  RUN_BASH_TOOL,
  RUN_BASH_DESCRIPTION,
  runBashParams,
  handleRunBash(log)
);

// Start server
const transport = new StdioServerTransport();
await mcpServer.connect(transport);
// Log successful startup
log({
  level: "info",
  data: "Server started successfully",
});
