'use client'

import { useState, useEffect } from 'react'
import { 
  Folder, 
  File, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Edit,
  FolderPlus,
  RefreshCw,
  Home,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import { FileInfo, BoxFileListResult } from '@/types/box'
import { formatBytes, formatRelativeTime } from '@/lib/utils'

interface FileExplorerProps {
  boxId: string
}

export function FileExplorer({ boxId }: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState('/')
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [pathHistory, setPathHistory] = useState<string[]>(['/'])

  const loadFiles = async (path: string = currentPath) => {
    setLoading(true)
    try {
      const result: BoxFileListResult = await apiClient.listFiles(boxId, path)
      setFiles(result.files || [])
      setCurrentPath(result.path || path)
    } catch (error) {
      console.error('Failed to load files:', error)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [boxId])

  const handleNavigateToPath = (path: string) => {
    if (path !== currentPath) {
      setPathHistory(prev => [...prev, currentPath])
      setCurrentPath(path)
      loadFiles(path)
      setSelectedFiles([])
    }
  }

  const handleGoUp = () => {
    const parentPath = currentPath === '/' ? '/' : currentPath.split('/').slice(0, -1).join('/') || '/'
    handleNavigateToPath(parentPath)
  }

  const handleGoHome = () => {
    handleNavigateToPath('/')
  }

  const handleGoBack = () => {
    if (pathHistory.length > 1) {
      const previousPath = pathHistory[pathHistory.length - 1]
      setPathHistory(prev => prev.slice(0, -1))
      setCurrentPath(previousPath)
      loadFiles(previousPath)
      setSelectedFiles([])
    }
  }

  const handleFileClick = (file: FileInfo) => {
    if (file.type === 'directory') {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
      handleNavigateToPath(newPath)
    } else {
      // Handle file selection or opening
      setSelectedFiles(prev => 
        prev.includes(file.path) 
          ? prev.filter(p => p !== file.path)
          : [...prev, file.path]
      )
    }
  }

  const renderPathBreadcrumb = () => {
    const pathParts = currentPath.split('/').filter(Boolean)
    
    return (
      <div className="flex items-center space-x-1 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoHome}
          className="px-2 py-1 h-auto"
        >
          <Home className="h-3 w-3" />
        </Button>
        
        {pathParts.map((part, index) => {
          const partPath = '/' + pathParts.slice(0, index + 1).join('/')
          const isLast = index === pathParts.length - 1
          
          return (
            <div key={partPath} className="flex items-center space-x-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => !isLast && handleNavigateToPath(partPath)}
                className={`px-2 py-1 h-auto ${isLast ? 'font-medium' : 'text-muted-foreground'}`}
                disabled={isLast}
              >
                {part}
              </Button>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="h-full p-6">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle className="flex items-center space-x-2">
                <Folder className="h-5 w-5" />
                <span>File Explorer</span>
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Box: {boxId}
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoBack}
                disabled={pathHistory.length <= 1}
              >
                ← Back
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoUp}
                disabled={currentPath === '/'}
              >
                ↑ Up
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadFiles()}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button variant="outline" size="sm">
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>

              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>

          <div className="border rounded-md p-3 bg-muted/20">
            {renderPathBreadcrumb()}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  <p className="text-sm text-muted-foreground">Loading files...</p>
                </div>
              </div>
            ) : files.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="font-medium">Empty Directory</h3>
                    <p className="text-sm text-muted-foreground">
                      No files or folders in this directory
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {files.map((file) => {
                  const isSelected = selectedFiles.includes(file.path)
                  
                  return (
                    <div
                      key={file.path}
                      className={`flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer border ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-transparent'
                      }`}
                      onClick={() => handleFileClick(file)}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="shrink-0">
                          {file.type === 'directory' ? (
                            <Folder className="h-5 w-5 text-blue-500" />
                          ) : (
                            <File className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatRelativeTime(file.modified)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          {file.type === 'file' && (
                            <div className="text-sm text-muted-foreground">
                              {formatBytes(file.size)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Mode: {file.mode.toString(8)}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          {file.type === 'file' && (
                            <>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Download className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}