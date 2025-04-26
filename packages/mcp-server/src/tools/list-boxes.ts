import { withLogging } from "../utils.js";
import { Gbox } from "../service/index.js";
import type { Logger } from '../service/gbox.instance.js';

export const LIST_BOXES_TOOL = "list-boxes";
export const LIST_BOXES_DESCRIPTION = "List all boxes.";

export const handleListBoxes = withLogging(
  async (logger: Logger, {}, { sessionId, signal }) => {
    const gbox = new Gbox();
    const boxesDetails = await gbox.boxes.getBoxes({ signal, sessionId });

    logger.info(`Listing boxes${sessionId ? ` for session: ${sessionId}` : ""}`);

    logger.info(`Found ${boxesDetails.count} boxes`);

    // Extract only the 'attrs' part from each box for a cleaner output
    const boxAttributes = boxesDetails.boxes.map(box => box.attrs);

    return {
      content: [
        {
          type: "text" as const,
          // Stringify only the extracted attributes
          text: JSON.stringify(boxAttributes, null, 2),
        },
      ],
    };
  }
);
