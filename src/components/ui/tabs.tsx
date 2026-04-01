import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  activeTab: string
  setActiveTab: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

function useTabsContext() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('Tabs compound components must be used within <Tabs>')
  return ctx
}

// --- Tabs root ---

interface TabsProps {
  defaultValue: string
  children: React.ReactNode
  className?: string
}

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue)
  const value = React.useMemo(() => ({ activeTab, setActiveTab }), [activeTab])

  return (
    <TabsContext.Provider value={value}>
      <div className={cn('flex flex-col min-h-0', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// --- TabList ---

interface TabListProps {
  children: React.ReactNode
  className?: string
}

export function TabList({ children, className }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex shrink-0 border-b border-border',
        className,
      )}
    >
      {children}
    </div>
  )
}

// --- Tab ---

interface TabProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function Tab({ value, children, className }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext()
  const isActive = activeTab === value

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      data-active={isActive || undefined}
      className={cn(
        'flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors',
        isActive
          ? 'text-foreground border-b-2 border-primary -mb-px'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  )
}

// --- TabPanel ---
// Uses CSS display:none to hide inactive panels instead of unmounting.
// This prevents Leva's useControls from losing state on tab switch.

interface TabPanelProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabPanel({ value, children, className }: TabPanelProps) {
  const { activeTab } = useTabsContext()
  const isActive = activeTab === value

  return (
    <div
      role="tabpanel"
      className={cn('flex-1 overflow-y-auto', className)}
      style={{ display: isActive ? undefined : 'none' }}
    >
      {children}
    </div>
  )
}
