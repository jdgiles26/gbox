import { config } from "./config.js";
import { Gbox } from "./service/index.js";
import {
  withLogging,
  withLoggingResourceTemplate,
} from "./utils.js";
import type { Logger } from "./service/gbox.instance.js";

// Box interface
interface Box {
  id: string;
  image: string;
  status: string;
}

// Define box resource template
const boxTemplate = withLoggingResourceTemplate("gbox:///boxes/{boxId}", {
  list: async (logger: Logger, { signal, sessionId }) => {
    logger.info("Starting to fetch boxes");

    const gbox = new Gbox();

    const response = await gbox.boxes.getBoxes({ signal, sessionId });
    logger.info(`Found ${response.boxes.length} boxes`);

    if (!response.boxes || response.boxes.length === 0) {
      logger.info("No boxes found, returning empty list");
      return { resources: [] };
    }

    logger.info("Mapping boxes to resource format");
    const resources = response.boxes.map((box: Box) => {
      const resource = {
        uri: `gbox:///boxes/${box.id}`,
        name: `Box ${box.id}`,
        description: `Status: ${box.status}, Image: ${box.image}. Note: When executing code, if the box is stopped, it will be automatically started first. This is suitable when previous processes have stopped but disk contents are preserved.`,
        mimeType: "application/json",
      };
      logger.debug(`Mapped box ${box.id} to resource`);
      return resource;
    });

    logger.info("Successfully completed box list operation");
    return { resources };
  },
});

// Box resource handler
export const handleBoxResource = withLogging(
  async (logger: Logger, uri, { boxId }, { signal, sessionId }) => {
    boxId = Array.isArray(boxId) ? boxId[0] : boxId;
    if (!boxId) {
      logger.error("Box ID is missing");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Box ID is required" }, null, 2),
          },
        ],
      };
    }

    const gbox = new Gbox();

    const box = await gbox.boxes.getBox(boxId, { signal, sessionId });
    logger.info(`Successfully fetched box ${boxId}`);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              ...box,
              description:
                "When executing code, if the box is stopped, it will be automatically started first. This is suitable when previous processes have stopped but disk contents are preserved.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

export { boxTemplate };
