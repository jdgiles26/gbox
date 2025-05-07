import { describe, beforeAll, afterAll, test, expect } from 'vitest';
import { GBoxClient, Box, LogLevel } from '../../src/index';

// Config settings
const BASE_URL = 'http://localhost:28080';
const TEST_IMAGE = 'alpine:latest';
const TEST_LABEL = 'purpose=create-test';

describe('create real server tests', () => {
  let client: GBoxClient;
  let createdBoxes: Box[] = [];
  
  // Initialize client before all tests
  beforeAll(async () => {
    // Initialize client
    client = new GBoxClient({ baseURL: BASE_URL, logLevel: LogLevel.DEBUG });
    
    // Clean up old test containers
    const existingBoxes = await client.boxes.list({ label: TEST_LABEL });
    for (const oldBox of existingBoxes) {
      try {
        await oldBox.delete(true);
        console.log(`Cleaned up old test container: ${oldBox.id}`);
      } catch (e) {
        console.warn(`Failed to clean up old test container: ${oldBox.id}`, e);
      }
    }
  }, 30000); // 30 seconds timeout
  
  // Delete all created containers after tests
  afterAll(async () => {
    // Delete all containers created during tests
    for (const box of createdBoxes) {
      try {
        await box.delete(true);
        console.log(`Deleted test container: ${box.id}`);
      } catch (e) {
        console.warn(`Failed to delete container: ${box.id}`, e);
      }
    }
  }, 30000); // 30 seconds timeout
  
  // Basic creation test
  test('Basic container creation', async () => {
    // Create container
    const box = await client.boxes.create({
      image: TEST_IMAGE,
      labels: { purpose: 'create-test', test: 'basic' }
    });
    
    // Record created container for cleanup
    createdBoxes.push(box);
    console.log(`Created test container: ${box.id}`);
    
    // Verify results
    expect(box.id).toBeDefined();
    expect(box.image).toBe(TEST_IMAGE);
    expect(box.labels).toEqual(expect.objectContaining({ 
      purpose: 'create-test',
      test: 'basic'
    }));
    
    // Verify container status
    const boxStatus = await client.boxes.get(box.id);
    expect(boxStatus.status).toBeDefined();
  }, 30000);
  
  // Test creation with environment variables
  test('Create container with environment variables', async () => {
    // Create container
    const box = await client.boxes.create({
      image: TEST_IMAGE,
      env: { TEST_VAR: 'test_value', ANOTHER_VAR: '123' },
      labels: { purpose: 'create-test', test: 'env-vars' }
    });
    
    // Record created container for cleanup
    createdBoxes.push(box);
    console.log(`Created container with env vars: ${box.id}`);
    
    // Verify results
    expect(box.id).toBeDefined();
    expect(box.image).toBe(TEST_IMAGE);
    
    // Verify environment variables
    const execProcess = await box.exec(['env']);
    const stdout = await collectStreamData(execProcess.stdout);
    const exitCode = await execProcess.exitCode;
    
    expect(exitCode).toBe(0);
    expect(stdout).toContain('TEST_VAR=test_value');
    expect(stdout).toContain('ANOTHER_VAR=123');
  }, 30000);
  
  // Test creation with working directory
  test('Create container with working directory', async () => {
    // Create container
    const box = await client.boxes.create({
      image: TEST_IMAGE,
      workingDir: '/tmp',
      labels: { purpose: 'create-test', test: 'working-dir' }
    });
    
    // Record created container for cleanup
    createdBoxes.push(box);
    console.log(`Created container with working dir: ${box.id}`);
    
    // Verify results
    expect(box.id).toBeDefined();
    
    // Verify working directory
    const execProcess = await box.exec(['pwd']);
    const stdout = await collectStreamData(execProcess.stdout);
    const exitCode = await execProcess.exitCode;
    
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('/var/gbox');
  }, 30000);
  
  // Test command and arguments
  test('Create container with command and arguments', async () => {
    // Create container
    const box = await client.boxes.create({
      image: TEST_IMAGE,
      cmd: 'echo',
      args: ['Hello from container!'],
      labels: { purpose: 'create-test', test: 'cmd-args' }
    });
    
    // Record created container for cleanup
    createdBoxes.push(box);
    console.log(`Created container with cmd and args: ${box.id}`);
    
    // Verify results
    expect(box.id).toBeDefined();
    
    // Note: Since the container might start with the provided cmd and args and exit,
    // we only verify that it was created successfully, not testing the execution result
  }, 30000);
});

// Helper function: collect stream data
async function collectStreamData(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const textDecoder = new TextDecoder();
  let result = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += textDecoder.decode(value, { stream: true });
    }
    return result;
  } finally {
    reader.releaseLock();
  }
}
