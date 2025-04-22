// Export the main client
export { GBoxClient } from './client.ts';

// Export configuration types/interfaces if needed for external use
export type { GBoxClientConfig, Logger } from './config.ts';

// Export managers if direct access is desired (though usually accessed via client)
// export { BoxManager } from './managers/boxManager.ts';
// export { FileManager } from './managers/fileManager.ts';

// Export custom error classes
export * from './errors.ts';

// Export types/interfaces that users of the SDK might need
export * from './types/box.ts';
export * from './types/file.ts';

// Export Model classes
export { Box } from './models/box.ts';
export { GBoxFile } from './models/file.ts'; 