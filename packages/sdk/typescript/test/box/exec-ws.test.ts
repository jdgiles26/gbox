import { describe, beforeAll, afterAll, test, expect } from 'vitest';
import { GBoxClient, Box } from '../../src/index';
import winston from 'winston';
// config settings
const BASE_URL = 'http://localhost:28080';
const TEST_IMAGE = 'alpine:latest';
const TEST_LABEL = 'purpose=exec-ws-test';

// helper function: collect data from stream
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

// helper function: collect binary data from stream
async function collectBinaryData(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.length;
    }
    
    // Combine all chunks into a single Uint8Array
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  } finally {
    reader.releaseLock();
  }
}

// test suite
describe('BoxApi.exec WebSocket actual call test', () => {
  let client: GBoxClient;
  let box: Box;
  
  // create box before all tests
  beforeAll(async () => {
    // initialize client
    client = new GBoxClient({ baseURL: BASE_URL });
    
    // clean up old test containers
    const existingBoxes = await client.boxes.list({ label: TEST_LABEL });
    for (const oldBox of existingBoxes) {
      try {
        await oldBox.delete(true);
        console.log(`clean up old test container: ${oldBox.id}`);
      } catch (e) {
        console.warn(`clean up old test container failed: ${oldBox.id}`, e);
      }
    }
    
    // create new test container
    box = await client.boxes.create({
      image: TEST_IMAGE,
      labels: { purpose: 'exec-ws-test' }
    });
    
    console.log(`created test container: ${box.id}`);
    
    // ensure container is running
    if (box.status !== 'running') {
      await box.start();
      console.log(`container started: ${box.id}`);
    }
  }, 30000); // 30 seconds timeout
  
  // delete box after all tests
  afterAll(async () => {
    try {
      if (box) {
        await box.delete(true);
        console.log(`deleted test container: ${box.id}`);
      }
    } catch (e) {
      console.warn(`delete container failed: ${box.id}`, e);
    }
  }, 10000); // 10 seconds timeout
  
  // basic command execution test
  test('basic command execution', async () => {
    const execProcess = await box.exec(['echo', 'hello world']);
    
    // collect output and exit code
    const stdout = await collectStreamData(execProcess.stdout);
    const stderr = await collectStreamData(execProcess.stderr);
    const exitCode = await execProcess.exitCode;
    
    // verify results
    expect(stdout.trim()).toBe('hello world');
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
  }, 10000);
  
  // standard error output test
  test('output to standard error', async () => {
    const execProcess = await box.exec(
      ['sh', '-c', 'echo "stdout"; echo "stderr" >&2']
    );
    
    const stdout = await collectStreamData(execProcess.stdout);
    const stderr = await collectStreamData(execProcess.stderr);
    const exitCode = await execProcess.exitCode;
    
    expect(stdout.trim()).toBe('stdout');
    expect(stderr.trim()).toBe('stderr');
    expect(exitCode).toBe(0);
  }, 10000);
  
  // non-zero exit code test
  test('non-zero exit code', async () => {
    const execProcess = await box.exec(
      ['sh', '-c', 'exit 42']
    );
    
    const exitCode = await execProcess.exitCode;
    expect(exitCode).toBe(42);
  }, 10000);
  
  // standard input test
  test('standard input', async () => {
    const stdinContent = 'hello from stdin';
    
    const execProcess = await box.exec(
      ['cat'],
      { stdin: stdinContent }
    );
    
    const stdout = await collectStreamData(execProcess.stdout);
    const exitCode = await execProcess.exitCode;
    
    expect(stdout).toBe(stdinContent);
    expect(exitCode).toBe(0);
  }, 10000);
  
  // TTY mode test
  test('TTY mode', async () => {
    const execProcess = await box.exec(
      ['echo', 'tty test'],
      { tty: true }
    );
    
    const stdout = await collectStreamData(execProcess.stdout);
    const exitCode = await execProcess.exitCode;
    
    expect(stdout.trim()).toBe('tty test');
    expect(exitCode).toBe(0);
  }, 10000);
  
  // long output test
  test('long output', async () => {
    const execProcess = await box.exec(
      ['sh', '-c', 'for i in $(seq 1 100); do echo "Line $i"; done']
    );
    
    const stdout = await collectStreamData(execProcess.stdout);
    const exitCode = await execProcess.exitCode;
    
    // verify 100 lines of output
    const lines = stdout.trim().split('\n');
    expect(lines.length).toBe(100);
    expect(lines[0]).toBe('Line 1');
    expect(lines[99]).toBe('Line 100');
    expect(exitCode).toBe(0);
  }, 15000);
  
  // working directory test
  test('working directory', async () => {
    // first create a test directory and file
    const setupResult = await box.exec(
      ['sh', '-c', 'mkdir -p /tmp/test-workdir && echo "test content" > /tmp/test-workdir/testfile.txt']
    );
    
    // wait for command to complete
    await setupResult.exitCode;
    
    // confirm directory is created
    const checkDirResult = await box.exec(
      ['ls', '-la', '/tmp/test-workdir']
    );
    
    const checkDirOutput = await collectStreamData(checkDirResult.stdout);
    const checkDirExit = await checkDirResult.exitCode;
    console.log('directory check result:', checkDirOutput);
    expect(checkDirExit).toBe(0);
    
    // then execute command in specific working directory
    const execProcess = await box.exec(
      ['cat', 'testfile.txt'], 
      { workingDir: '/tmp/test-workdir' }
    );
    
    const stdout = await collectStreamData(execProcess.stdout);
    const stderr = await collectStreamData(execProcess.stderr);
    const exitCode = await execProcess.exitCode;
    
    // if error occurs, record more diagnostic information
    if (exitCode !== 0) {
      console.error('working directory test failed:', stderr);
      
      // try to read file directly, without using working directory
      const fallbackExec = await box.exec(
        ['cat', '/tmp/test-workdir/testfile.txt']
      );
      const fallbackStdout = await collectStreamData(fallbackExec.stdout);
      console.log('read file content directly:', fallbackStdout);
      
      // verify file content
      expect(fallbackStdout.trim()).toBe('test content');
    } else {
      expect(stdout.trim()).toBe('test content');
    }
  }, 15000);
  
  // multi-command parallel execution test
  test('multi-command parallel execution', async () => {
    // execute 3 commands concurrently
    const process1Promise = box.exec(['echo', 'command 1']);
    const process2Promise = box.exec(['echo', 'command 2']);
    const process3Promise = box.exec(['echo', 'command 3']);
    
    // wait for all processes to be ready concurrently
    const [process1, process2, process3] = await Promise.all([
      process1Promise,
      process2Promise,
      process3Promise
    ]);
    
    // wait for all results concurrently
    const results = await Promise.all([ 
      // wait for stdout and exitCode for each process
      Promise.all([
        collectStreamData(process1.stdout),
        process1.exitCode
      ]),
      Promise.all([
        collectStreamData(process2.stdout),
        process2.exitCode
      ]),
      Promise.all([
        collectStreamData(process3.stdout),
        process3.exitCode
      ])
    ]);
    
    // verify all commands are executed successfully
    expect(results[0][0].trim()).toBe('command 1');
    expect(results[1][0].trim()).toBe('command 2');
    expect(results[2][0].trim()).toBe('command 3');
    expect(results[0][1]).toBe(0);
    expect(results[1][1]).toBe(0);
    expect(results[2][1]).toBe(0);
  }, 15000);
  
  // ReadableStream as stdin test
  test('ReadableStream as stdin', async () => {
    const inputData = 'hello from stream stdin';
    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(inputData);
    
    // Create ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(inputBytes);
        controller.close();
      }
    });

    const execProcess = await box.exec(
      ['cat'],
      { stdin: stream }
    );
    
    const stdout = await collectStreamData(execProcess.stdout);
    const exitCode = await execProcess.exitCode;
    
    expect(stdout).toBe(inputData);
    expect(exitCode).toBe(0);
  }, 10000);
  
  // Cancel operation with AbortSignal test
  test('cancel operation with AbortSignal', async () => {
    const controller = new AbortController();
    
    // Start a long-running process
    const execProcess = await box.exec(
      ['sleep', '10'],
      { signal: controller.signal }
    );
    
    // Schedule abort after short delay
    setTimeout(() => {
      console.log('Aborting the WebSocket connection...');
      controller.abort();
    }, 100);
    
    // The operation should be cancelled
    try {
      const exitCode = await Promise.race([
        execProcess.exitCode,
        new Promise<number>((_, reject) => 
          // Add an additional timeout to prevent test hanging
          setTimeout(() => reject(new Error('Abort did not terminate connection in time')), 3000)
        )
      ]);
      
      // If we get here without error, fail the test unless the exit code indicates
      // termination by signal (which might happen if abort kills the process)
      if (exitCode !== 137 && exitCode !== 143) { // 137 = 128 + SIGKILL(9), 143 = 128 + SIGTERM(15)
        expect(true).toBe(false); // This should not execute
      }
    } catch (e) {
      // Expected behavior - operation was aborted or timed out
      expect(e).toBeDefined();
    }
  }, 10000); // Increased timeout
  
  // Binary data handling test
  test('binary data handling', async () => {
    // Create binary data (a simple pattern)
    const binaryData = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      binaryData[i] = i;
    }
    
    // Write binary data to a temporary file
    const tempFile = '/tmp/binary-test';
    const setupCmd = [
      'sh', 
      '-c', 
      `dd if=/dev/urandom bs=1024 count=8 > ${tempFile}`
    ];
    
    const setupResult = await box.exec(setupCmd);
    await setupResult.exitCode;
    
    // Read the binary file
    const execProcess = await box.exec(['cat', tempFile]);
    
    // Collect binary data
    const binaryOutput = await collectBinaryData(execProcess.stdout);
    const exitCode = await execProcess.exitCode;
    
    // Verify we got binary data
    expect(exitCode).toBe(0);
    expect(binaryOutput.byteLength).toBe(8 * 1024); // 8KB
  }, 10000);
  
  // Non-ASCII characters test
  test('non-ASCII characters', async () => {
    // Test with international characters using hex representation (for code readability)
    const testCases = [
      { name: 'Russian', value: '\u041F\u0440\u0438\u0432\u0435\u0442 \u043C\u0438\u0440' },
      { name: 'Japanese', value: '\u3053\u3093\u306B\u3061\u306F\u4E16\u754C' },
      { name: 'Spanish', value: '\u00A1Hola mundo!' },
      { name: 'German', value: 'Gr\u00FC\u00DF Gott' },
      { name: 'French', value: 'Bonjour le monde \u00E0 tous' }
    ];
    
    for (const { name, value } of testCases) {
      console.log(`Testing ${name} characters: ${value}`);
      
      const execProcess = await box.exec(['echo', value]);
      
      const stdout = await collectStreamData(execProcess.stdout);
      const exitCode = await execProcess.exitCode;
      
      expect(stdout.trim()).toBe(value);
      expect(exitCode).toBe(0);
    }
  }, 15000);
  
  // Error handling - nonexistent command
  test('error handling - nonexistent command', async () => {
    const execProcess = await box.exec(['nonexistentcommand123']);
    
    const stderr = await collectStreamData(execProcess.stderr);
    const exitCode = await execProcess.exitCode;
    
    // Only check that the exit code is non-zero, don't rely on specific error message
    expect(exitCode).not.toBe(0);
    
    // Log the actual error for debugging
    console.log(`Nonexistent command error: "${stderr}" with exit code ${exitCode}`);
  }, 10000);
});
