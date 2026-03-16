import { useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { usePresets } from '@/hooks/usePresets'
import { cn } from '@/lib/utils'

export interface PresetPanelProps {
  sketchName: string | null
  /** Returns current param values for saving, or null if no render has occurred */
  getParams: () => Record<string, unknown> | null
  /** Called after loading a preset — pushes params into ControlPanel + render loop */
  onLoad: (params: Record<string, unknown>) => void
}

export function PresetPanel({
  sketchName,
  getParams,
  onLoad,
}: PresetPanelProps) {
  const { presets, loading, error, loadPreset, savePreset, deletePreset } =
    usePresets(sketchName)

  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null)

  const handleLoad = useCallback(
    async (name: string) => {
      setLoadingPreset(name)
      try {
        const params = await loadPreset(name)
        onLoad(params)
      } catch {
        // Error is surfaced via the hook's error state
      } finally {
        setLoadingPreset(null)
      }
    },
    [loadPreset, onLoad],
  )

  const handleSave = useCallback(async () => {
    // Sanitize to match server's SAFE_NAME_RE: /^[a-z0-9][a-z0-9_-]*$/
    const name = saveName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/^[-_]+/, '')
    if (!name) return
    const params = getParams()
    if (!params) return
    setSaving(true)
    try {
      await savePreset(name, params)
      setSaveName('')
    } catch {
      // Error is surfaced via the hook's error state
    } finally {
      setSaving(false)
    }
  }, [saveName, getParams, savePreset])

  const handleDelete = useCallback(
    async (name: string) => {
      if (!window.confirm(`Delete preset "${name}"?`)) return
      try {
        await deletePreset(name)
      } catch {
        // Error is surfaced via the hook's error state
      }
    },
    [deletePreset],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSave()
    },
    [handleSave],
  )

  const canSave = saveName.trim().length > 0 && !saving && !!sketchName

  return (
    <div data-testid="preset-panel" className="mt-2">
      {error && (
        <p className="mb-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder="Preset name"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
          aria-label="Preset name"
        />
        <Button
          variant="secondary"
          size="xs"
          disabled={!canSave}
          onClick={handleSave}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {loading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading...</p>
      ) : presets.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No presets</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-0.5">
          {presets.map((name) => (
            <li key={name} className="group flex items-center gap-1">
              <button
                className={cn(
                  'flex-1 truncate rounded-md px-2 py-1 text-left text-sm transition-colors',
                  'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  loadingPreset === name && 'opacity-50',
                )}
                onClick={() => handleLoad(name)}
                disabled={!!loadingPreset}
              >
                {name}
              </button>
              <button
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                onClick={() => handleDelete(name)}
                aria-label={`Delete preset ${name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
