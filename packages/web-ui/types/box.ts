export interface Box {
  id: string
  name: string
  type: 'linux' | 'android'
  status: 'creating' | 'running' | 'stopped' | 'error'
  image: string
  created_at: string
  updated_at: string
  uptime?: number
  cpu_usage?: number
  memory_usage?: number
  disk_usage?: number
  labels?: Record<string, string>
  ports?: PortMapping[]
  error?: string
}

export interface PortMapping {
  container_port: number
  host_port: number
  protocol: 'tcp' | 'udp'
}

export interface BoxCreateParams {
  image?: string
  labels?: Record<string, string>
  timeout?: number
  env?: Record<string, string>
}

export interface BoxExecParams {
  cmd: string[]
  env?: Record<string, string>
  cwd?: string
  timeout?: number
}

export interface BoxExecResult {
  stdout: string
  stderr: string
  exit_code: number
  execution_time: number
}

export interface BoxRunCodeParams {
  code: string
  language: 'python' | 'javascript' | 'typescript' | 'bash' | 'go' | 'rust'
  filename?: string
}

export interface BoxRunCodeResult {
  stdout: string
  stderr: string
  exit_code: number
  execution_time: number
}

export interface BoxFileListResult {
  files: FileInfo[]
  path: string
}

export interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  mode: number
  modified: string
  is_hidden: boolean
}

export interface BoxFileReadResult {
  content: string
  path: string
  size: number
  encoding: string
}

export interface BoxFileWriteParams {
  path: string
  content: string
  mode?: number
}

export interface BoxFileWriteResult {
  path: string
  size: number
}

export interface BoxActionScreenshotParams {
  format?: 'png' | 'jpeg'
  quality?: number
}

export interface BoxActionScreenshotResult {
  screenshot: string // base64 encoded
  format: string
  width: number
  height: number
}