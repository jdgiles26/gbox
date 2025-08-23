'use client'

import { useState } from 'react'
import { Plus, Play, Square, Trash2, MoreVertical, Activity, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Box } from '@/types/box'
import { formatRelativeTime, formatBytes, getStatusBadgeVariant } from '@/lib/utils'
import { useBoxes } from '@/hooks/use-boxes'

interface BoxGridProps {
  boxes: Box[]
  loading: boolean
  onSelectBox: (box: Box) => void
  onRefresh: () => void
}

export function BoxGrid({ boxes, loading, onSelectBox }: BoxGridProps) {
  const { createBox, deleteBox, startBox, stopBox } = useBoxes()
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const handleAction = async (boxId: string, action: () => Promise<void>) => {
    setActionLoading(prev => ({ ...prev, [boxId]: true }))
    try {
      await action()
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setActionLoading(prev => ({ ...prev, [boxId]: false }))
    }
  }

  const handleCreateBox = async (type: 'linux' | 'android') => {
    try {
      await createBox(type)
    } catch (error) {
      console.error('Failed to create box:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading boxes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Sandbox Boxes</h2>
          <p className="text-muted-foreground">
            Manage your AI agent sandbox containers
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => handleCreateBox('linux')}>
            <Plus className="h-4 w-4 mr-2" />
            Linux Box
          </Button>
          <Button variant="outline" onClick={() => handleCreateBox('android')}>
            <Plus className="h-4 w-4 mr-2" />
            Android Box
          </Button>
        </div>
      </div>

      {boxes.length === 0 ? (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <div className="bg-muted rounded-full p-3 w-16 h-16 mx-auto mb-4">
              <Plus className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No boxes yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first sandbox box to get started with AI agent development.
            </p>
            <div className="flex justify-center space-x-2">
              <Button onClick={() => handleCreateBox('linux')}>
                Create Linux Box
              </Button>
              <Button variant="outline" onClick={() => handleCreateBox('android')}>
                Create Android Box
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {boxes.map((box) => (
            <Card 
              key={box.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onSelectBox(box)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg truncate">
                    {box.name || box.id}
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Handle more options
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={getStatusBadgeVariant(box.status)}>
                    {box.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {box.type}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Image:</span>
                    <span className="truncate ml-2">{box.image}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{formatRelativeTime(box.created_at)}</span>
                  </div>
                  {box.uptime && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Uptime:</span>
                      <span>{Math.floor(box.uptime / 3600)}h {Math.floor((box.uptime % 3600) / 60)}m</span>
                    </div>
                  )}
                </div>

                {(box.cpu_usage !== undefined || box.memory_usage !== undefined) && (
                  <div className="space-y-2">
                    {box.cpu_usage !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1">
                          <Activity className="h-3 w-3" />
                          <span>CPU</span>
                        </div>
                        <span>{box.cpu_usage.toFixed(1)}%</span>
                      </div>
                    )}
                    {box.memory_usage !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1">
                          <HardDrive className="h-3 w-3" />
                          <span>Memory</span>
                        </div>
                        <span>{formatBytes(box.memory_usage)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  {box.status === 'stopped' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={actionLoading[box.id]}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAction(box.id, () => startBox(box.id))
                      }}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  ) : box.status === 'running' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={actionLoading[box.id]}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAction(box.id, () => stopBox(box.id))
                      }}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Stop
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="flex-1" disabled>
                      {box.status === 'creating' ? 'Creating...' : 'Error'}
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actionLoading[box.id]}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAction(box.id, () => deleteBox(box.id))
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}