import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { boxTemplate, handleBoxResource } from "./resources.js";
import {
  LIST_BOXES_TOOL,
  LIST_BOXES_DESCRIPTION,
  RUN_PYTHON_TOOL,
  RUN_PYTHON_DESCRIPTION,
  RUN_BASH_TOOL,
  RUN_BASH_DESCRIPTION,
  READ_FILE_TOOL,
  READ_FILE_DESCRIPTION,
  handleListBoxes,
  handleRunPython,
  handleRunBash,
  handleReadFile,
  runPythonParams,
  runBashParams,
  readFileParams,
} from "./tools/index.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  handleRunTypescript,
  RUN_TYPESCRIPT_DESCRIPTION,
  RUN_TYPESCRIPT_TOOL,
  runTypescriptParams,
} from "./tools/run-typescript.js";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { MCPLogger } from "./mcp-logger.js";

let transport: SSEServerTransport | null = null;

const app = express();

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
    },
  }
);

// Create an instance of MCPLogger
const logger = new MCPLogger();

// Register box resource, passing the logger instance
mcpServer.resource("box", boxTemplate(logger), handleBoxResource(logger));

// Register run-python prompt (doesn't use logger directly)
mcpServer.prompt(
  RUN_PYTHON_TOOL,
  RUN_PYTHON_DESCRIPTION,
  (_: RequestHandlerExtra) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `When running Python code in a sandbox, if you don't provide a boxId, the system will try to reuse an existing box with matching image. 
              The system will first try to use a running box, then a stopped box (which will be started), and finally create a new one if needed. 
              Note that without boxId, multiple calls may use different boxes even if they exist. 
              If you need to ensure multiple calls use the same box, you must provide a boxId. 
              You can use the 'list-boxes' tool to see available boxes.`,
          },
        },
      ],
    };
  }
);

// Register tools, passing the logger instance
mcpServer.tool(
  LIST_BOXES_TOOL,
  LIST_BOXES_DESCRIPTION,
  {},
  handleListBoxes(logger)
);

mcpServer.tool(
  READ_FILE_TOOL,
  READ_FILE_DESCRIPTION,
  readFileParams,
  handleReadFile(logger)
);

mcpServer.tool(
  RUN_PYTHON_TOOL,
  RUN_PYTHON_DESCRIPTION,
  runPythonParams,
  handleRunPython(logger)
);

mcpServer.tool(
  RUN_TYPESCRIPT_TOOL,
  RUN_TYPESCRIPT_DESCRIPTION,
  runTypescriptParams,
  handleRunTypescript(logger)
);

mcpServer.tool(
  RUN_BASH_TOOL,
  RUN_BASH_DESCRIPTION,
  runBashParams,
  handleRunBash(logger)
);

app.get("/sse", (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  mcpServer.connect(transport);
});

app.post("/messages", (req, res) => {
  if (transport) {
    transport.handlePostMessage(req, res);
  }
});

const port = process.env.PORT || 28090;

app.listen(port, () => {
  console.log(`Server started successfully on port ${port}`);
});
