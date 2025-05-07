import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GBoxClient, Box, APIError, BrowserContext, BrowserPage, Logger } from '../../src/index.ts'; // Adjust path as necessary
import type { BoxCreateOptions } from '../../src/types/box.ts';

const logger = new Logger('BrowserPageTest');
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
        logger.info(` Initialized GBoxClient for ${GBOX_URL}`);
    });

    afterAll(async () => {
        if (testBox) {
            logger.info(` Cleaning up Box: ${testBox.id}`);
            try {
                await testBox.stop();
                await testBox.delete();
                logger.info(` Box ${testBox.id} deleted successfully.`);
            } catch (error) {
                logger.error(` Failed to delete Box ${testBox?.id}:`, error);
                // Optionally re-throw or handle if cleanup failure is critical
            }
        } else {
            logger.info(' No Box to clean up.');
        }
    });

    it('should create a box, context, page, get content, and take a screenshot', async () => {
        logger.info(' Starting test: Create Box, Context, Page, Interact');

        // 1. Create Box
        try {
            logger.info(' Creating Box with config:', boxConfig);
            testBox = await gbox.boxes.create(boxConfig);
            expect(testBox).toBeInstanceOf(Box);
            expect(testBox.id).toBeDefined();
            logger.info(`Box created: ${testBox.id}`);
        } catch (error) {
            logger.error('Failed to create Box:', error);
            throw error; // Fail the test if box creation fails
        }

        // 2. Initialize Browser Manager
        const browser = testBox.initBrowser();
        expect(browser).toBeDefined();
        logger.info(`Browser manager initialized for Box ${testBox.id}`);

        // 3. Create Context
        let context: BrowserContext | null = null;
        try {
            logger.info('Creating browser context...');
            context = await browser.createContext();
            expect(context).toBeInstanceOf(BrowserContext);
            expect(context.id).toBeDefined();
            logger.info(`Browser context created: ${context.id}`);
        } catch (error) {
            logger.error('Failed to create browser context:', error);
            throw error;
        }


        // 4. Create Page
        let page: BrowserPage | null = null;
        const testUrl = 'https://www.google.com'; // Example URL
        try {
            logger.info(`Creating browser page and navigating to ${testUrl}...`);
            page = await context.createPage({ url: testUrl });
            expect(page).toBeInstanceOf(BrowserPage);
            expect(page.id).toBeDefined();
            logger.info(`Browser page created: ${page.id}`);
        } catch (error) {
            logger.error('Failed to create browser page:', error);
            throw error;
        }

        // 5. Get Page Content (optional check)
        try {
            logger.info(`Getting content for page ${page.id}...`);
            const content = await page.getContent('html'); // Get HTML content
            expect(content).toBeDefined();
            expect(content.content).toContain('<html'); // Basic check for HTML structure
            // expect(content.url).toBe(testUrl); // URL might change due to redirects
            expect(content.title).toBeDefined();
            logger.info(`Successfully retrieved content for page ${page.id}. Title: ${content.title}`);
        } catch (error) {
            logger.error(`Failed to get content for page ${page.id}:`, error);
            throw error;
        }

        // 6. Take Screenshot
        try {
            logger.info(`Taking screenshot for page ${page.id}...`);
            const result = await page.screenshot({ outputFormat: 'base64' });
            expect(result).toBeDefined();
            expect(result.base64_content).toBeDefined();
            expect(result.base64_content?.length).toBeGreaterThan(100); // Check if base64 string seems valid
            logger.info(`Successfully took screenshot for page ${page.id}. Image data length: ${result.base64_content?.length}`);

            // Optional: Save screenshot for manual inspection if needed
            // import fs from 'fs';
            // fs.writeFileSync('e2e_screenshot.png', Buffer.from(result.imageData, 'base64'));
            // logger.info('Screenshot saved to e2e_screenshot.png');

        } catch (error) {
            logger.error(`Failed to take screenshot for page ${page.id}:`, error);
            throw error;
        }

         // 7. Close Page (Good practice)
         try {
            logger.info(`Closing page ${page.id}...`);
            await context.closePage(page.id);
            logger.info(`Page ${page.id} closed.`);
        } catch (error) {
            // Log error but don't fail the test, proceed to context closing
             logger.warn(`Could not close page ${page?.id}:`, error);
        }

        // 8. Close Context (Good practice)
        try {
            logger.info(`Closing context ${context.id}...`);
            await browser.closeContext(context.id);
            logger.info(`Context ${context.id} closed.`);
        } catch (error) {
            // Log error but don't fail the test, proceed to box deletion in afterAll
             logger.warn(`Could not close context ${context?.id}:`, error);
        }

        logger.info('Test completed successfully.');
    });

    // Add more 'it' blocks for other browser scenarios (e.g., interacting with elements)
}); 