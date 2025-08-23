'use client'

import { RefreshCw, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Box } from '@/types/box'
import { getStatusBadgeVariant } from '@/lib/utils'

interface HeaderProps {
  boxes: Box[]
  selectedBox: Box | null
  onBoxSelect: (box: Box | null) => void
  onRefresh: () => void
}

export function Header({ boxes, selectedBox, onBoxSelect, onRefresh }: HeaderProps) {
  return (
    <header className="border-b bg-background px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold">gbox</h1>
          <Badge variant="outline" className="text-xs">
            AI Agent Sandbox
          </Badge>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Active Box:</span>
            <Select
              value={selectedBox?.id || ''}
              onValueChange={(value) => {
                const box = boxes.find(b => b.id === value)
                onBoxSelect(box || null)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select a box">
                  {selectedBox && (
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusBadgeVariant(selectedBox.status)} className="text-xs">
                        {selectedBox.status}
                      </Badge>
                      <span className="truncate">{selectedBox.name || selectedBox.id}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {boxes.map((box) => (
                  <SelectItem key={box.id} value={box.id}>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusBadgeVariant(box.status)} className="text-xs">
                        {box.status}
                      </Badge>
                      <span>{box.name || box.id}</span>
                      <span className="text-xs text-muted-foreground">({box.type})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Box
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}