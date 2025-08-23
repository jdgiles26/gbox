'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Box } from '@/types/box'
import { 
  LayoutGrid, 
  Terminal, 
  FileText, 
  Bot, 
  Monitor,
  Activity,
  Settings
} from 'lucide-react'

interface SidebarProps {
  activeView: 'overview' | 'terminal' | 'files' | 'cua'
  onViewChange: (view: 'overview' | 'terminal' | 'files' | 'cua') => void
  selectedBox: Box | null
}

export function Sidebar({ activeView, onViewChange, selectedBox }: SidebarProps) {
  const navItems = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: LayoutGrid,
      description: 'Box management and status',
      disabled: false,
    },
    {
      id: 'terminal' as const,
      label: 'Terminal',
      icon: Terminal,
      description: 'Interactive terminal access',
      disabled: !selectedBox,
    },
    {
      id: 'files' as const,
      label: 'Files',
      icon: FileText,
      description: 'File browser and editor',
      disabled: !selectedBox,
    },
    {
      id: 'cua' as const,
      label: 'Computer Use Agent',
      icon: Bot,
      description: 'AI-powered automation',
      disabled: false,
    },
  ]

  return (
    <aside className="w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full flex-col">
        <div className="p-6">
          <div className="flex items-center space-x-2">
            <Monitor className="h-6 w-6" />
            <span className="font-semibold">Sandbox Control</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id
            
            return (
              <Button
                key={item.id}
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start h-auto p-3',
                  item.disabled && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => !item.disabled && onViewChange(item.id)}
                disabled={item.disabled}
              >
                <div className="flex items-start space-x-3">
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.description}
                    </div>
                  </div>
                </div>
              </Button>
            )
          })}
        </nav>

        <div className="p-4 border-t">
          {selectedBox && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Selected Box</div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {selectedBox.name || selectedBox.id}
                  </span>
                  <Badge variant={selectedBox.status === 'running' ? 'default' : 'secondary'}>
                    {selectedBox.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Type: {selectedBox.type}
                </div>
                <div className="text-xs text-muted-foreground">
                  Image: {selectedBox.image}
                </div>
                {selectedBox.cpu_usage !== undefined && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Activity className="h-3 w-3" />
                    <span className="text-xs">
                      CPU: {selectedBox.cpu_usage.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button variant="ghost" size="sm" className="w-full mt-4">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>
    </aside>
  )
}