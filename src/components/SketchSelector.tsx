import { cn } from '@/lib/utils'

export interface SketchSelectorProps {
  sketches: string[]
  activeSketch: string | null
  onSelect: (name: string) => void
  loading: boolean
}

/** Strip a leading YYYY-MM-DD- date prefix from a sketch directory name */
export function formatSketchName(slug: string): string {
  const stripped = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '')
  return stripped
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function SketchSelector({
  sketches,
  activeSketch,
  onSelect,
  loading,
}: SketchSelectorProps) {
  if (sketches.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        No sketches found
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-0.5 px-2 py-1">
      {sketches.map((name) => {
        const isActive = name === activeSketch
        const isLoading = loading && isActive

        return (
          <li key={name}>
            <button
              aria-current={isActive ? 'true' : undefined}
              type="button"
              className={cn(
                'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
              onClick={() => onSelect(name)}
              disabled={isLoading}
            >
              <span className="truncate">{formatSketchName(name)}</span>
              {isLoading && (
                <span
                  className="ml-auto h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-label="Loading"
                />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
