'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { BoxGrid } from '@/components/box-grid'
import { Terminal } from '@/components/terminal'
import { FileExplorer } from '@/components/file-explorer'
import { CUAInterface } from '@/components/cua-interface'
import { useBoxes } from '@/hooks/use-boxes'
import { Box } from '@/types/box'

export default function HomePage() {
  const { boxes, loading, refresh } = useBoxes()
  const [selectedBox, setSelectedBox] = useState<Box | null>(null)
  const [activeView, setActiveView] = useState<'overview' | 'terminal' | 'files' | 'cua'>('overview')

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        selectedBox={selectedBox}
      />
      
      <div className="flex-1 flex flex-col">
        <Header
          boxes={boxes}
          selectedBox={selectedBox}
          onBoxSelect={setSelectedBox}
          onRefresh={refresh}
        />
        
        <main className="flex-1 overflow-hidden">
          {activeView === 'overview' && (
            <BoxGrid
              boxes={boxes}
              loading={loading}
              onSelectBox={setSelectedBox}
              onRefresh={refresh}
            />
          )}
          
          {activeView === 'terminal' && selectedBox && (
            <Terminal boxId={selectedBox.id} />
          )}
          
          {activeView === 'files' && selectedBox && (
            <FileExplorer boxId={selectedBox.id} />
          )}
          
          {activeView === 'cua' && (
            <CUAInterface />
          )}
        </main>
      </div>
    </div>
  )
}