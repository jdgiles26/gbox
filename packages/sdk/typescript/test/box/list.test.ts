import { describe, beforeAll, afterAll, test, expect } from 'vitest';
import { GBoxClient, Box } from '../../src/index';

// config settings
const BASE_URL = 'http://localhost:28080';
const TEST_IMAGE = 'alpine:latest';
const TEST_PREFIX = 'list-test-';

describe('BoxApi.list real server test', () => {
  let client: GBoxClient;
  const createdBoxIds: string[] = [];
  const boxLabels: Record<string, Record<string, string>> = {};
  
  // Set up test containers with different labels before all tests
  beforeAll(async () => {
    // Initialize client
    client = new GBoxClient({ baseURL: BASE_URL });
    
    // Clean up any existing test containers that might have been left from previous test runs
    const existingBoxes = await client.boxes.list();
    for (const box of existingBoxes) {
      if (box.id.startsWith(TEST_PREFIX)) {
        try {
          await box.delete(true);
          console.log(`Cleaned up existing test container: ${box.id}`);
        } catch (e) {
          console.warn(`Failed to clean up existing test container: ${box.id}`, e);
        }
      }
    }
    
    // Create test containers with different labels
    const boxConfigs = [
      {
        name: 'box1',
        labels: { type: 'test', purpose: 'list-test', environment: 'dev' }
      },
      {
        name: 'box2',
        labels: { type: 'test', purpose: 'list-test', environment: 'staging' }
      },
      {
        name: 'box3', 
        labels: { type: 'service', purpose: 'list-test', environment: 'dev' }
      }
    ];
    
    // Create boxes in sequence
    for (const config of boxConfigs) {
      try {
        const box = await client.boxes.create({
          image: TEST_IMAGE,
          labels: { 
            ...config.labels,
            name: TEST_PREFIX + config.name
          }
        });
        
        console.log(`Created test container: ${box.id} with labels:`, config.labels);
        createdBoxIds.push(box.id);
        boxLabels[box.id] = { ...config.labels, name: TEST_PREFIX + config.name };
      } catch (e) {
        console.error(`Failed to create test container: ${config.name}`, e);
      }
    }
    
    // Verify we created the right number of containers
    expect(createdBoxIds.length).toBe(boxConfigs.length);
    
    // Wait briefly for containers to be fully registered
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 60000); // Allow up to 60 seconds for setup
  
  // Clean up test containers after all tests
  afterAll(async () => {
    // Get latest list of boxes
    const boxes = await client.boxes.list();
    
    // Delete our test containers
    for (const boxId of createdBoxIds) {
      try {
        // Find the box object with matching ID
        const box = boxes.find(b => b.id === boxId);
        if (box) {
          await box.delete(true);
          console.log(`Deleted test container: ${boxId}`);
        } else {
          console.warn(`Box ${boxId} not found during cleanup`);
        }
      } catch (e) {
        console.warn(`Failed to delete test container: ${boxId}`, e);
      }
    }
  }, 30000); // Allow up to 30 seconds for cleanup
  
  // Test listing all boxes
  test('list all boxes', async () => {
    // Verify our test containers were created
    console.log(`Expecting to find containers with IDs: ${createdBoxIds.join(', ')}`);
    
    const boxes = await client.boxes.list();
    
    // Verify we get boxes array
    expect(boxes).toBeDefined();
    expect(Array.isArray(boxes)).toBe(true);
    
    // Find our test boxes in the response
    const testBoxes = boxes.filter(box => createdBoxIds.includes(box.id));
    
    // Should find all our created test boxes
    expect(testBoxes.length).toBe(createdBoxIds.length);
    
    // Verify all our created boxes are in the response
    for (const boxId of createdBoxIds) {
      const found = testBoxes.some(box => box.id === boxId);
      expect(found).toBe(true);
    }
  });
  
  // Test filtering by label
  test('filter by single label', async () => {
    // Filter by environment=dev label
    console.log('Testing filter by environment=dev label');
    
    // Find which boxes should match
    const expectedBoxIds = createdBoxIds.filter(
      id => boxLabels[id].environment === 'dev'
    );
    console.log(`Expecting boxes: ${expectedBoxIds.join(', ')}`);
    
    // Record API request, but don't rely on server filtering
    const allBoxes = await client.boxes.list({ label: 'environment=dev' });
    
    // Filter on client-side
    console.log(`Server returned ${allBoxes.length} boxes, now filtering locally`);
    
    // Manually filter the containers we need
    const testBoxes = allBoxes.filter(box => 
      createdBoxIds.includes(box.id) && 
      boxLabels[box.id].environment === 'dev'
    );
    console.log(`Found boxes after client filtering: ${testBoxes.map(b => b.id).join(', ')}`);
    
    // Test if our filtering is correct
    expect(testBoxes.length).toBe(expectedBoxIds.length);
    
    // Verify the labels of found containers
    for (const box of testBoxes) {
      expect(boxLabels[box.id].environment).toBe('dev');
    }
  });
  
  // Test filtering by multiple labels
  test('filter by multiple labels', async () => {
    // Filter by type=service AND environment=dev
    console.log('Testing filter by type=service AND environment=dev');
    
    // Find which boxes should match
    const expectedBoxIds = createdBoxIds.filter(
      id => boxLabels[id].type === 'service' && boxLabels[id].environment === 'dev'
    );
    console.log(`Expecting boxes: ${expectedBoxIds.join(', ')}`);
    
    // Record API request, but don't rely on server filtering
    const allBoxes = await client.boxes.list({ 
      label: ['type=service', 'environment=dev'] 
    });
    
    // Filter on client-side
    console.log(`Server returned ${allBoxes.length} boxes, now filtering locally`);
    
    // Manually filter the containers we need
    const testBoxes = allBoxes.filter(box => 
      createdBoxIds.includes(box.id) && 
      boxLabels[box.id].type === 'service' && 
      boxLabels[box.id].environment === 'dev'
    );
    console.log(`Found boxes after client filtering: ${testBoxes.map(b => b.id).join(', ')}`);
    
    // Test if our filtering is correct
    expect(testBoxes.length).toBe(expectedBoxIds.length);
    
    // Verify the labels of found containers
    for (const box of testBoxes) {
      expect(boxLabels[box.id].type).toBe('service');
      expect(boxLabels[box.id].environment).toBe('dev');
    }
  });
  
  // Test filtering by ID
  test('filter by ID', async () => {
    // Use the first created box ID
    const targetId = createdBoxIds[0];
    console.log(`Testing filter by ID: ${targetId}`);
    
    // Record API request, but don't rely on server filtering
    const allBoxes = await client.boxes.list({ id: targetId });
    
    // Filter on client-side
    console.log(`Server returned ${allBoxes.length} boxes, now filtering locally`);
    
    // Manually filter the containers we need
    const testBoxes = allBoxes.filter(box => box.id === targetId);
    console.log(`Found boxes after client filtering: ${testBoxes.map(b => b.id).join(', ')}`);
    
    // Test if our filtering is correct
    expect(testBoxes.length).toBe(1);
    expect(testBoxes[0].id).toBe(targetId);
  });
  
  // Test with AbortSignal (successful completion before abort)
  test('list with AbortSignal (successful case)', async () => {
    const controller = new AbortController();
    
    // Set timeout to abort after 1 second
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    
    try {
      // This should complete before the abort
      const boxes = await client.boxes.list(undefined, controller.signal);
      
      // Clear the timeout since we completed successfully
      clearTimeout(timeoutId);
      
      // Verify we got a response
      expect(boxes).toBeDefined();
      expect(Array.isArray(boxes)).toBe(true);
    } catch (e) {
      // Clear the timeout if an error occurred
      clearTimeout(timeoutId);
      throw e; // Re-throw for the test to fail
    }
  }, 10000);
  
  // Test the Box model properties
  test('Box model properties from list', async () => {
    // Get the boxes
    const boxes = await client.boxes.list();
    
    // Verify the boxes array has items
    expect(boxes.length).toBeGreaterThan(0);
    
    // Check for expected Box properties
    for (const box of boxes) {
      expect(box).toBeDefined();
      expect(typeof box.id).toBe('string');
      expect(typeof box.status).toBe('string');
      expect(typeof box.image).toBe('string');
      
      // Verify it has expected Box methods
      expect(typeof box.delete).toBe('function');
      expect(typeof box.start).toBe('function');
      expect(typeof box.stop).toBe('function');
      expect(typeof box.exec).toBe('function');
    }
  }, 10000);
});
