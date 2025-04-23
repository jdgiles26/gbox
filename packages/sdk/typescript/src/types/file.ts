// Represents metadata about a file (from X-Gbox-File-Stat header)
export interface FileInfo {
  name: string; // From Python doc example
  path?: string; // Add path for consistency, might be added by manager
  size: number;
  mode: string; // Python doc shows string like "-rw-r--r--"
  modTime: string; // Modification time (ISO string)
  isDir?: boolean; // Based on mode or type?
  type?: 'file' | 'dir' | 'link'; // Python doc example shows type
  mime?: string; // Python doc example shows mime
  // Add other potential fields from API like linkTarget if needed
}

// Removed FileInfoResponse as info comes from header

// Removed ShareFromBoxParams (now arguments to share method)

// Response structure for the share operation (POST /api/v1/files?operation=share)
export interface FileShareApiResponse {
    success?: boolean;
    message?: string;
    fileList?: FileInfo[]; // Based on Python doc example
}

// Removed ShareResponse

// Response structure for the reclaim operation (POST /api/v1/files?operation=reclaim)
export interface FileReclaimApiResponse {
  reclaimed_files?: string[];
  errors?: string[];
}

// Removed FilesReclaimResponse 