import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  useDefaultLayout,
} from 'react-resizable-panels'
import { Drawer } from '@base-ui/react/drawer'
import { Menu, SlidersHorizontal, PanelLeftOpen, PanelRightOpen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ResizeHandle } from '@/components/ResizeHandle'
import { useIsMobile } from '@/hooks/useIsMobile'

interface PanelLayoutProps {
  leftContent: ReactNode
  centerContent: ReactNode
  rightContent: ReactNode
}

export function PanelLayout({
  leftContent,
  centerContent,
  rightContent,
}: PanelLayoutProps) {
  const isMobile = useIsMobile()
  const leftPanelRef = useRef<PanelImperativeHandle>(null)
  const rightPanelRef = useRef<PanelImperativeHandle>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'plotter-layout',
  })

  const toggleLeft = useCallback(() => {
    const panel = leftPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }, [])

  const toggleRight = useCallback(() => {
    const panel = rightPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }, [])

  // Keyboard shortcuts: Cmd+[ toggles left, Cmd+] toggles right
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '[') {
        e.preventDefault()
        toggleLeft()
      } else if (e.key === ']') {
        e.preventDefault()
        toggleRight()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleLeft, toggleRight])

  if (isMobile) {
    return (
      <MobileLayout
        left={leftContent}
        center={centerContent}
        right={rightContent}
      />
    )
  }

  return (
    <Group
      orientation="horizontal"
      className="h-screen"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <Panel
        panelRef={leftPanelRef}
        id="left"
        defaultSize="15%"
        minSize="10%"
        maxSize="25%"
        collapsible
        onResize={(size) => setLeftCollapsed(size.asPercentage === 0)}
      >
        {leftContent}
      </Panel>
      <ResizeHandle />
      <Panel id="center" defaultSize="55%" minSize="30%">
        <main className="relative h-full">
          {leftCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 top-1 z-10"
              onClick={toggleLeft}
              aria-label="Show left sidebar"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          )}
          {rightCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 z-10"
              onClick={toggleRight}
              aria-label="Show right sidebar"
            >
              <PanelRightOpen className="size-4" />
            </Button>
          )}
          {centerContent}
        </main>
      </Panel>
      <ResizeHandle />
      <Panel
        panelRef={rightPanelRef}
        id="right"
        defaultSize="30%"
        minSize="15%"
        maxSize="40%"
        collapsible
        onResize={(size) => setRightCollapsed(size.asPercentage === 0)}
      >
        {rightContent}
      </Panel>
    </Group>
  )
}

function MobileLayout({
  left,
  center,
  right,
}: {
  left: ReactNode
  center: ReactNode
  right: ReactNode
}) {
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLeftOpen(true)}
          aria-label="Open sketches"
        >
          <Menu className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRightOpen(true)}
          aria-label="Open controls"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1">{center}</div>

      <Drawer.Root
        open={leftOpen}
        onOpenChange={setLeftOpen}
        swipeDirection="left"
      >
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 bg-black/50 transition-opacity" />
          <Drawer.Popup className="fixed inset-y-0 left-0 w-72 bg-card shadow-lg">
            {left}
          </Drawer.Popup>
        </Drawer.Portal>
      </Drawer.Root>

      <Drawer.Root
        open={rightOpen}
        onOpenChange={setRightOpen}
        swipeDirection="right"
      >
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 bg-black/50 transition-opacity" />
          <Drawer.Popup className="fixed inset-y-0 right-0 w-80 bg-card shadow-lg">
            {right}
          </Drawer.Popup>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  )
}
