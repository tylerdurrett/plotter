import { Separator } from 'react-resizable-panels'

import { cn } from '@/lib/utils'

export function ResizeHandle({ className }: { className?: string }) {
  return (
    <Separator
      className={cn(
        'w-px transition-opacity hover:bg-border hover:opacity-100 data-separator:focus-visible:bg-border data-separator:focus-visible:opacity-100',
        className,
      )}
    />
  )
}
