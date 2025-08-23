import axios from 'axios'
import { Box, BoxCreateParams, BoxExecParams, BoxExecResult, BoxRunCodeParams, BoxRunCodeResult, BoxFileListResult, BoxFileReadResult, BoxFileWriteParams, BoxFileWriteResult, BoxActionScreenshotResult } from '@/types/box'
import { ApiResponse, VersionInfo, CuaExecuteParams } from '@/types/api'

const api = axios.create({
  baseURL: typeof window !== 'undefined' ? '/api/v1' : process.env.GBOX_API_URL + '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export class ApiClient {
  // Box Management
  async listBoxes(): Promise<Box[]> {
    const response = await api.get<Box[]>('/boxes')
    return response.data
  }

  async getBox(id: string): Promise<Box> {
    const response = await api.get<Box>(`/boxes/${id}`)
    return response.data
  }

  async createLinuxBox(params?: BoxCreateParams): Promise<Box> {
    const response = await api.post<Box>('/boxes/linux', params)
    return response.data
  }

  async createAndroidBox(params?: BoxCreateParams): Promise<Box> {
    const response = await api.post<Box>('/boxes/android', params)
    return response.data
  }

  async deleteBox(id: string): Promise<void> {
    await api.delete(`/boxes/${id}`)
  }

  async startBox(id: string): Promise<void> {
    await api.post(`/boxes/${id}/start`)
  }

  async stopBox(id: string): Promise<void> {
    await api.post(`/boxes/${id}/stop`)
  }

  // Box Commands
  async execCommand(id: string, params: BoxExecParams): Promise<BoxExecResult> {
    const response = await api.post<BoxExecResult>(`/boxes/${id}/commands`, params)
    return response.data
  }

  async runCode(id: string, params: BoxRunCodeParams): Promise<BoxRunCodeResult> {
    const response = await api.post<BoxRunCodeResult>(`/boxes/${id}/run-code`, params)
    return response.data
  }

  // File System
  async listFiles(id: string, path?: string, depth?: number): Promise<BoxFileListResult> {
    const params = new URLSearchParams()
    if (path) params.append('path', path)
    if (depth) params.append('depth', depth.toString())
    
    const response = await api.get<BoxFileListResult>(`/boxes/${id}/fs/list?${params}`)
    return response.data
  }

  async readFile(id: string, path: string): Promise<BoxFileReadResult> {
    const params = new URLSearchParams({ path })
    const response = await api.get<BoxFileReadResult>(`/boxes/${id}/fs/read?${params}`)
    return response.data
  }

  async writeFile(id: string, params: BoxFileWriteParams): Promise<BoxFileWriteResult> {
    const response = await api.post<BoxFileWriteResult>(`/boxes/${id}/fs/write`, params)
    return response.data
  }

  // Screenshots and Actions
  async takeScreenshot(id: string): Promise<BoxActionScreenshotResult> {
    const response = await api.post<BoxActionScreenshotResult>(`/boxes/${id}/actions/screenshot`, {})
    return response.data
  }

  // Browser
  async getBrowserCdpUrl(id: string): Promise<string> {
    const response = await api.get(`/boxes/${id}/browser/connect-url/cdp`)
    return response.data
  }

  // CUA (Computer Use Agent)
  async executeCuaTask(params: CuaExecuteParams): Promise<EventSource> {
    // For CUA, we need to use EventSource for SSE
    const url = new URL('/api/v1/cua/execute', window.location.origin)
    
    // Create a POST request to start the CUA task and get SSE stream
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`CUA execution failed: ${response.statusText}`)
    }

    // For now, return a mock EventSource - in real implementation, 
    // the server should redirect to an SSE endpoint
    const eventSource = new EventSource('/api/v1/cua/stream')
    return eventSource
  }

  // System
  async getVersion(): Promise<VersionInfo> {
    const response = await api.get<VersionInfo>('/version')
    return response.data
  }
}

export const apiClient = new ApiClient()

// WebSocket helper for terminal connections
export function createTerminalWebSocket(boxId: string, command: string): WebSocket {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/boxes/${boxId}/exec?cmd=${encodeURIComponent(command)}`
  
  return new WebSocket(wsUrl)
}