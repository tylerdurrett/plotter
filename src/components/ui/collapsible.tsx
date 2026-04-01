import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
  /** Content rendered at the right edge of the header (e.g. a thumbnail). */
  headerRight?: React.ReactNode
}

export function Collapsible({ title, defaultOpen = false, children, className, headerRight }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn('border-b border-border', className)}>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            'size-3 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
        {title}
        {headerRight && (
          <span className="ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}
