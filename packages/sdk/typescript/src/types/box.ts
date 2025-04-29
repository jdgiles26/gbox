// Basic structure for a Box object returned by the API
export interface BoxData {
  id: string;
  status: string; // Consider using an enum: 'running', 'stopped', 'creating', etc.
  image: string;
  labels?: Record<string, string>;
  // Add other fields based on API responses (e.g., ports, created_at)
}

// Options for creating a new Box
export interface BoxCreateOptions {
  image: string;
  imagePullSecret?: string;
  env?: Record<string, string>;
  cmd?: string;
  args?: string[];
  workingDir?: string;
  labels?: Record<string, string>; // Matches 'extra_labels' in Python API but mapped here
  volumes?: VolumeMount[];
}

export interface VolumeMount {
  source: string;
  target: string;
  readOnly?: boolean;
  propagation?:
    | 'private'
    | 'rprivate'
    | 'shared'
    | 'rshared'
    | 'slave'
    | 'rslave';
}

// Response structure for listing boxes
export interface BoxListResponse {
  boxes: BoxData[];
}

// Response structure for getting a single box (often just the BoxData itself)
export type BoxGetResponse = BoxData; // Assuming API returns the box data directly

// Response structure for creating a box
export type BoxCreateResponse = BoxData & { message?: string };

// Filters for listing boxes
export interface BoxListFilters {
  id?: string | string[];
  label?: string | string[]; // e.g., 'key=value' or 'key'
  ancestor?: string;
  // Add other potential filters
}

// Structure for running a command
export interface BoxRunCommand {
  cmd: string[]; // First element is command, rest are args (mirroring Python API)
  // Add options like user, tty if supported by API
}

// Options for running a command in a box
export interface BoxRunOptions {
  stdin?: string;
  stdoutLineLimit?: number;
  stderrLineLimit?: number;
  signal?: AbortSignal;
  sessionId?: string;
}

// Response structure for running a command
export interface BoxRunResponse {
  box?: BoxData;
  exitCode?: number;
  stdout: string;
  stderr: string;
}

// Response structure for deleting all boxes
export interface BoxesDeleteResponse {
  count: number;
  message: string;
  ids: string[];
}

// Response structure for reclaim operation
export interface BoxReclaimResponse {
  message: string;
  stoppedIds?: string[];
  deletedIds?: string[];
  stoppedCount?: number;
  deletedCount?: number;
}

// Response type for extracting an archive (PUT)
export interface BoxExtractArchiveResponse {
  message: string; // Assuming a success message
  // Add other fields if the API returns more
}

// --- New Exec Types (Promise-based) ---

// Result type for the buffered exec
export type BoxExecResult = {
  /** The exit code of the command. */
  exitCode: number;
  /** The buffered standard output as a string. */
  stdout: string;
  /** The buffered standard error as a string. */
  stderr: string;
  /** The buffered standard output as an ArrayBuffer. */
  stdoutBuffer: ArrayBuffer;
  /** The buffered standard error as an ArrayBuffer. */
  stderrBuffer: ArrayBuffer;
};

/**
 * Options for the Box.exec() method.
 */
export type BoxExecOptions = {
  /** Whether to allocate a pseudo-TTY. Default: false */
  tty?: boolean;
  /** Optional AbortSignal to cancel the operation. */
  signal?: AbortSignal;
};

// --- End New Exec Types ---

// Stream type constants (matching backend)
export type StreamType = 0 | 1 | 2;

// Define constants for clarity, matching original enum keys
export const StreamTypeStdin: StreamType = 0;
export const StreamTypeStdout: StreamType = 1;
export const StreamTypeStderr: StreamType = 2;

// Structure for the final exit message from the backend
export interface ExitMessage {
  type: 'exit';
  exitCode: number;
}
