# @gru.ai/gbox SDK

[![npm version](https://badge.fury.io/js/%40gru.ai%2Fgbox.svg)](https://badge.fury.io/js/%40gru.ai%2Fgbox)

Node.js SDK for Gru gbox. Gbox provides a self-hostable sandbox environment designed for AI agents, offering capabilities like terminal access, file management, and browser interaction.
This SDK allows Node.js applications to programmatically manage GBox resources, primarily the execution environments (Boxes) and the shared file volume, enabling seamless integration with agent workflows.

## Installation

Using pnpm:
```bash
pnpm add @gru.ai/gbox
```

Using npm:
```bash
npm install @gru.ai/gbox
```

Using yarn:
```bash
yarn add @gru.ai/gbox
```

## Usage Examples

### 1. Initialize the Client

```typescript
import { GBoxClient } from '@gru.ai/gbox';

const GBOX_URL = process.env.GBOX_URL || 'http://localhost:28080';

// Initialize with default logger (console)
const gbox = new GBoxClient({ baseURL: GBOX_URL });

// Or initialize with a custom logger or no logger
// import type { Logger } from '@gru.ai/gbox';
// const myLogger: Logger = { debug: ()=>{}, info: ()=>{}, warn: ()=>{}, error: ()=>{} };
// const gboxWithLogger = new GBoxClient({ baseURL: GBOX_URL, logger: myLogger });
```

### 2. Box Management

```typescript
import { GBoxClient, Box } from '@gru.ai/gbox';
const gbox = new GBoxClient({ baseURL: GBOX_URL }); // Assumes client is initialized

async function manageBoxes() {
    // Create a new box
    const newBox = await gbox.boxes.create({
        image: 'alpine:latest',
        labels: { project: 'my-app' }
    });
    console.log(`Created box: ${newBox.id}`);

    // Get a box by ID
    const fetchedBox = await gbox.boxes.get(newBox.id);
    console.log(`Fetched box status: ${fetchedBox.status}`);

    // List boxes (optionally filter by labels, status, etc.)
    const allBoxes = await gbox.boxes.list();
    console.log(`Total boxes: ${allBoxes.length}`);

    const projectBoxes = await gbox.boxes.list({ label: 'project=my-app' });
    console.log(`Boxes for project 'my-app': ${projectBoxes.length}`);
    
    // Delete a box (use force=true to remove associated resources)
    await newBox.delete(true);
    console.log(`Deleted box: ${newBox.id}`);
    
    // Delete all boxes (use with caution!)
    // await gbox.boxes.delete_all({ force: true }); 
}

manageBoxes();
```

### 3. Box Lifecycle & Command Execution

```typescript
import { GBoxClient, Box, APIError } from '@gru.ai/gbox';
const gbox = new GBoxClient({ baseURL: GBOX_URL }); // Assumes client is initialized

async function useBox(boxId: string) { // Pass a valid box ID
    try {
        const box = await gbox.boxes.get(boxId);

        // Start the box if not running
        if (box.status !== 'running') {
            await box.start();
             await new Promise(resolve => setTimeout(resolve, 1500)); // Wait a bit
        }
        console.log(`Box ${box.id} is running.`);

        // Run a command
        const runResult = await box.run(['pwd']);
        console.log(`pwd stdout: ${runResult.stdout?.trim()}`);
        
        const runResultComplex = await box.run(['sh', '-c', 'echo "Output via sh" && ls /tmp']);
        console.log(`sh stdout: ${runResultComplex.stdout?.trim()}`);

        // Stop the box
        await box.stop({ timeout: 5 });
        console.log(`Box ${box.id} stopped.`);

    } catch (error) {
        if (error instanceof APIError) {
            console.error(`API Error using box ${boxId}: ${error.message}`);
        } else {
             console.error(`Error using box ${boxId}:`, error);
        }
        // Remember to clean up the box even if errors occurred during use
        try { await gbox.boxes.delete(boxId, true); } catch { /* ignore cleanup error */ }
    }
}
```

### 4. File Operations (CopyTo / CopyFrom)

```typescript
import { GBoxClient, Box } from '@gru.ai/gbox';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const gbox = new GBoxClient({ baseURL: GBOX_URL }); // Assumes client is initialized

async function manageFiles(box: Box) { // Pass a running Box object
    const localTempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gbox-files-'));
    console.log(`Using temp dir: ${localTempDir}`);

    try {
        // copyTo: Upload local file to box
        const localUploadFile = path.join(localTempDir, 'upload.txt');
        await fs.promises.writeFile(localUploadFile, 'Hello Box!');
        await box.copyTo(localUploadFile, '/tmp/');
        console.log(`Uploaded ${localUploadFile} to box:/tmp/`);

        // copyFrom: Download file from box to local
        const boxDownloadFile = '/etc/hostname';
        const localDownloadPath = path.join(localTempDir, 'box_hostname.txt');
        await box.copyFrom(boxDownloadFile, localDownloadPath);
        console.log(`Downloaded box:${boxDownloadFile} to ${localDownloadPath}`);
        const content = await fs.promises.readFile(localDownloadPath, 'utf-8');
        console.log(`Downloaded content: ${content.trim()}`);

        // copyFrom: Download directory from box
        const boxDownloadDir = '/etc/ssl/'; // Example directory
        const localDownloadDirPath = path.join(localTempDir, 'ssl_certs');
        await box.copyFrom(boxDownloadDir, localDownloadDirPath);
        console.log(`Downloaded box:${boxDownloadDir} to ${localDownloadDirPath}`);

    } finally {
        // Clean up local temp directory
        await fs.promises.rm(localTempDir, { recursive: true, force: true });
    }
}
```

### 5. Browser Interaction (Requires Browser-Enabled Image)

```typescript
import { GBoxClient, Box } from '@gru.ai/gbox';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const gbox = new GBoxClient({ baseURL: GBOX_URL }); // Assumes client is initialized

async function useBrowser(box: Box) { // Pass a running Box object with a browser image
    const localTempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gbox-browser-'));
    console.log(`Using temp dir: ${localTempDir}`);

    try {
        const browser = box.initBrowser();
        const context = await browser.createContext();
        const page = await context.createPage({ url: 'https://example.com' });
        console.log(`Navigated to: ${await page.getUrl()}, Title: ${await page.getTitle()}`);

        const screenshotResult = await page.screenshot({ outputFormat: 'base64' });
        const screenshotPath = path.join(localTempDir, 'screenshot.png.b64');
        await fs.promises.writeFile(screenshotPath, screenshotResult.data);
        console.log(`Screenshot saved (base64) to ${screenshotPath}`);

        await context.close();

    } catch (error) {
        console.error("Browser interaction failed:", error);
    } finally {
        // Clean up local temp directory
        await fs.promises.rm(localTempDir, { recursive: true, force: true });
    }
}
```

## API Documentation

*(TODO: Link to generated API documentation if available, e.g., using TypeDoc)*

## License

This SDK is licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file for details. 