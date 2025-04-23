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
  propagation?: 'private' | 'rprivate' | 'shared' | 'rshared' | 'slave' | 'rslave';
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