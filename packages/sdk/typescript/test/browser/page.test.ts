import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GBoxClient, Box, APIError, BrowserContext, BrowserPage } from '../../src/index.ts'; // Adjust path as necessary
import type { BoxCreateOptions } from '../../src/types/box.ts';

const GBOX_URL = process.env.GBOX_URL || 'http://localhost:28080';
const BROWSER_IMAGE = process.env.GBOX_BROWSER_IMAGE || 'babelcloud/gbox-playwright'; // Use an env var for the image

describe('Browser E2E Tests', { timeout: 60000 }, () => { // Increase timeout for E2E
    let gbox: GBoxClient;
    let testBox: Box | null = null;
    const boxConfig: BoxCreateOptions = {
        image: BROWSER_IMAGE,
        labels: { purpose: 'ts_sdk_browser_e2e', testRun: Date.now().toString() },
    };

    beforeAll(() => {
        gbox = new GBoxClient({ baseURL: GBOX_URL });
        gbox.logger.info(`[Browser E2E] Initialized GBoxClient for ${GBOX_URL}`);
    });

    afterAll(async () => {
        if (testBox) {
            gbox.logger.info(`[Browser E2E] Cleaning up Box: ${testBox.id}`);
            try {
                await testBox.stop();
                await testBox.delete();
                gbox.logger.info(`[Browser E2E] Box ${testBox.id} deleted successfully.`);
            } catch (error) {
                gbox.logger.error(`[Browser E2E] Failed to delete Box ${testBox?.id}:`, error);
                // Optionally re-throw or handle if cleanup failure is critical
            }
        } else {
            gbox.logger.info('[Browser E2E] No Box to clean up.');
        }
    });

    it('should create a box, context, page, get content, and take a screenshot', async () => {
        gbox.logger.info('[Browser E2E] Starting test: Create Box, Context, Page, Interact');

        // 1. Create Box
        try {
            gbox.logger.info('[Browser E2E] Creating Box with config:', boxConfig);
            testBox = await gbox.boxes.create(boxConfig);
            expect(testBox).toBeInstanceOf(Box);
            expect(testBox.id).toBeDefined();
            gbox.logger.info(`[Browser E2E] Box created: ${testBox.id}`);
        } catch (error) {
            gbox.logger.error('[Browser E2E] Failed to create Box:', error);
            throw error; // Fail the test if box creation fails
        }

        // 2. Initialize Browser Manager
        const browser = testBox.initBrowser();
        expect(browser).toBeDefined();
        gbox.logger.info(`[Browser E2E] Browser manager initialized for Box ${testBox.id}`);

        // 3. Create Context
        let context: BrowserContext | null = null;
        try {
            gbox.logger.info('[Browser E2E] Creating browser context...');
            context = await browser.createContext();
            expect(context).toBeInstanceOf(BrowserContext);
            expect(context.id).toBeDefined();
            gbox.logger.info(`[Browser E2E] Browser context created: ${context.id}`);
        } catch (error) {
            gbox.logger.error('[Browser E2E] Failed to create browser context:', error);
            throw error;
        }


        // 4. Create Page
        let page: BrowserPage | null = null;
        const testUrl = 'https://www.google.com'; // Example URL
        try {
            gbox.logger.info(`[Browser E2E] Creating browser page and navigating to ${testUrl}...`);
            page = await context.createPage({ url: testUrl });
            expect(page).toBeInstanceOf(BrowserPage);
            expect(page.id).toBeDefined();
            gbox.logger.info(`[Browser E2E] Browser page created: ${page.id}`);
        } catch (error) {
            gbox.logger.error('[Browser E2E] Failed to create browser page:', error);
            throw error;
        }

        // 5. Get Page Content (optional check)
        try {
            gbox.logger.info(`[Browser E2E] Getting content for page ${page.id}...`);
            const content = await page.getContent('html'); // Get HTML content
            expect(content).toBeDefined();
            expect(content.content).toContain('<html'); // Basic check for HTML structure
            // expect(content.url).toBe(testUrl); // URL might change due to redirects
            expect(content.title).toBeDefined();
            gbox.logger.info(`[Browser E2E] Successfully retrieved content for page ${page.id}. Title: ${content.title}`);
        } catch (error) {
            gbox.logger.error(`[Browser E2E] Failed to get content for page ${page.id}:`, error);
            throw error;
        }

        // 6. Take Screenshot
        try {
            gbox.logger.info(`[Browser E2E] Taking screenshot for page ${page.id}...`);
            const result = await page.screenshot({ outputFormat: 'base64' });
            expect(result).toBeDefined();
            expect(result.base64_content).toBeDefined();
            expect(result.base64_content?.length).toBeGreaterThan(100); // Check if base64 string seems valid
            gbox.logger.info(`[Browser E2E] Successfully took screenshot for page ${page.id}. Image data length: ${result.base64_content?.length}`);

            // Optional: Save screenshot for manual inspection if needed
            // import fs from 'fs';
            // fs.writeFileSync('e2e_screenshot.png', Buffer.from(result.imageData, 'base64'));
            // gbox.logger.info('[Browser E2E] Screenshot saved to e2e_screenshot.png');

        } catch (error) {
            gbox.logger.error(`[Browser E2E] Failed to take screenshot for page ${page.id}:`, error);
            throw error;
        }

         // 7. Close Page (Good practice)
         try {
            gbox.logger.info(`[Browser E2E] Closing page ${page.id}...`);
            await context.closePage(page.id);
            gbox.logger.info(`[Browser E2E] Page ${page.id} closed.`);
        } catch (error) {
            // Log error but don't fail the test, proceed to context closing
             gbox.logger.warn(`[Browser E2E] Could not close page ${page?.id}:`, error);
        }

        // 8. Close Context (Good practice)
        try {
            gbox.logger.info(`[Browser E2E] Closing context ${context.id}...`);
            await browser.closeContext(context.id);
            gbox.logger.info(`[Browser E2E] Context ${context.id} closed.`);
        } catch (error) {
            // Log error but don't fail the test, proceed to box deletion in afterAll
             gbox.logger.warn(`[Browser E2E] Could not close context ${context?.id}:`, error);
        }

        gbox.logger.info('[Browser E2E] Test completed successfully.');
    });

    // Add more 'it' blocks for other browser scenarios (e.g., interacting with elements)
}); 