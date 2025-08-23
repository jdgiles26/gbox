'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTerminal } from '@/hooks/use-terminal'
import { 
  Play, 
  Square, 
  RotateCcw, 
  Maximize2, 
  Copy,
  Terminal as TerminalIcon,
  Wifi,
  WifiOff
} from 'lucide-react'

interface TerminalProps {
  boxId: string
}

export function Terminal({ boxId }: TerminalProps) {
  const terminalElementRef = useRef<HTMLDivElement>(null)
  const {
    initTerminal,
    connectToBox,
    disconnect,
    clearTerminal,
    resizeTerminal,
    isConnected,
  } = useTerminal()
  
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (terminalElementRef.current) {
      const cleanup = initTerminal(terminalElementRef.current)
      return cleanup
    }
  }, [initTerminal])

  useEffect(() => {
    if (boxId && !isConnected) {
      connectToBox(boxId)
    }
  }, [boxId, connectToBox, isConnected])

  useEffect(() => {
    const handleResize = () => {
      resizeTerminal()
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [resizeTerminal])

  const handleConnect = () => {
    if (isConnected) {
      disconnect()
    } else {
      connectToBox(boxId)
    }
  }

  const handleClear = () => {
    clearTerminal()
  }

  const handleMaximize = () => {
    setIsMaximized(!isMaximized)
    // Give the DOM time to update before resizing
    setTimeout(() => {
      resizeTerminal()
    }, 100)
  }

  return (
    <div className={`${isMaximized ? 'fixed inset-0 z-50 bg-background' : 'h-full'} p-6`}>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TerminalIcon className="h-5 w-5" />
              <CardTitle>Terminal</CardTitle>
              <Badge variant="outline" className="text-xs">
                Box: {boxId}
              </Badge>
              <div className="flex items-center space-x-1">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <Badge variant="default" className="text-xs">
                      Connected
                    </Badge>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive" className="text-xs">
                      Disconnected
                    </Badge>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
              >
                {isConnected ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Disconnect
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Copy terminal content (this would need additional implementation)
                  console.log('Copy terminal content')
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleMaximize}
              >
                <Maximize2 className={`h-4 w-4 ${isMaximized ? 'rotate-45' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0">
          <div className="h-full border rounded-md overflow-hidden">
            <div 
              ref={terminalElementRef}
              className="h-full w-full"
              style={{ 
                minHeight: isMaximized ? 'calc(100vh - 120px)' : '500px'
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}