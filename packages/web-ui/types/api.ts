export interface ApiError {
  code: string
  message: string
  details?: any
}

export interface ApiResponse<T = any> {
  data?: T
  error?: ApiError
  success: boolean
}

export interface VersionInfo {
  version: string
  build_time: string
  commit_id: string
  go_version: string
}

export interface CuaExecuteParams {
  openai_api_key: string
  task: string
}

export interface WebSocketMessage<T = any> {
  type: string
  data?: T
  error?: string
  timestamp: string
}

export interface TerminalMessage {
  type: 'stdout' | 'stderr' | 'exit' | 'error'
  data: string
  exit_code?: number
}

export interface SystemStats {
  cpu_percent: number
  memory_percent: number
  disk_percent: number
  network_rx: number
  network_tx: number
}