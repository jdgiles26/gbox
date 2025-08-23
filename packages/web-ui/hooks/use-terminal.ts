'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { createTerminalWebSocket } from '@/lib/api'

export function useTerminal(boxId?: string) {
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const initTerminal = (element: HTMLElement) => {
    if (terminalRef.current) {
      terminalRef.current.dispose()
    }

    const terminal = new Terminal({
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: '#484848',
      },
      cursorBlink: true,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(element)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      terminal.dispose()
    }
  }

  const connectToBox = (boxId: string, command: string = '/bin/bash') => {
    if (!terminalRef.current) return

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    const ws = createTerminalWebSocket(boxId, command)

    ws.onopen = () => {
      setIsConnected(true)
      terminalRef.current?.write('\r\n*** Connected to box ***\r\n')
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'stdout' || message.type === 'stderr') {
          terminalRef.current?.write(message.data)
        } else if (message.type === 'exit') {
          terminalRef.current?.write(`\r\n*** Process exited with code ${message.exit_code} ***\r\n`)
        }
      } catch (error) {
        // If it's not JSON, treat as raw data
        terminalRef.current?.write(event.data)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      terminalRef.current?.write('\r\n*** Connection error ***\r\n')
    }

    ws.onclose = () => {
      setIsConnected(false)
      terminalRef.current?.write('\r\n*** Connection closed ***\r\n')
    }

    // Handle terminal input
    if (terminalRef.current) {
      terminalRef.current.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }))
        }
      })
    }

    wsRef.current = ws
  }

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
      setIsConnected(false)
    }
  }

  const writeToTerminal = (data: string) => {
    terminalRef.current?.write(data)
  }

  const clearTerminal = () => {
    terminalRef.current?.clear()
  }

  const resizeTerminal = () => {
    fitAddonRef.current?.fit()
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (terminalRef.current) {
        terminalRef.current.dispose()
      }
    }
  }, [])

  return {
    initTerminal,
    connectToBox,
    disconnect,
    writeToTerminal,
    clearTerminal,
    resizeTerminal,
    isConnected,
  }
}