import { useCallback, useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { UseMapApiResult } from '@/hooks/useMapApi'
import { API_PREFIX } from '@/lib/map-api'
import type { SessionInfo } from '@/lib/map-api'

interface MapGeneratePanelProps {
  mapApi: UseMapApiResult
  /** Called after a successful generation or session selection with the mapBundle param value */
  onSelectBundle: (bundleValue: string) => void
  /** The currently selected mapBundle param value */
  selectedBundle?: string
  /** Pipeline config overrides to include when generating maps */
  config?: Record<string, unknown>
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatSourceImage(name: string): string {
  const stripped = name.replace(/\.[^.]+$/, '')
  return stripped.length > 25 ? stripped.slice(0, 25) + '…' : stripped
}

export function MapGeneratePanel({
  mapApi,
  onSelectBundle,
  selectedBundle,
  config,
}: MapGeneratePanelProps) {
  const { apiAvailable, checking, sessions, generating, error } = mapApi
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [lastGeneratedFile, setLastGeneratedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) {
      setSelectedFile(file)
    }
  }, [])

  const handleGenerate = useCallback(async (file?: File) => {
    const imageFile = file ?? selectedFile
    if (!imageFile) return
    try {
      const opts = config && Object.keys(config).length > 0 ? { config } : undefined
      const response = await mapApi.generate(imageFile, opts)
      onSelectBundle(`${API_PREFIX}${response.session_id}`)
      setLastGeneratedFile(imageFile)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      // Error is surfaced via mapApi.error
    }
  }, [selectedFile, mapApi, onSelectBundle, config])

  const handleRegenerate = useCallback(() => {
    if (lastGeneratedFile) handleGenerate(lastGeneratedFile)
  }, [lastGeneratedFile, handleGenerate])

  const handleSessionSelect = useCallback(
    (session: SessionInfo) => {
      onSelectBundle(`${API_PREFIX}${session.session_id}`)
    },
    [onSelectBundle],
  )

  const handleSessionDelete = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation()
      await mapApi.deleteSession(sessionId)
      // If the deleted session was selected, clear selection
      if (selectedBundle === `${API_PREFIX}${sessionId}`) {
        onSelectBundle('none')
      }
    },
    [mapApi, selectedBundle, onSelectBundle],
  )

  return (
    <div className="p-3 border-t border-border">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        Map Generator
      </h3>

      {/* Server status */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`size-2 rounded-full ${
            checking
              ? 'bg-yellow-500'
              : apiAvailable
                ? 'bg-green-500'
                : 'bg-red-500'
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {checking
            ? 'Checking...'
            : apiAvailable
              ? 'Map API connected'
              : 'Map API offline'}
        </span>
      </div>

      {/* Image upload */}
      {apiAvailable && (
        <div className="space-y-2 mb-3">
          <div
            className={`border border-dashed rounded-md p-3 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            {selectedFile ? (
              <p className="text-xs text-foreground truncate">{selectedFile.name}</p>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="size-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Drop image or click to select
                </p>
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={!selectedFile || generating}
            onClick={() => handleGenerate()}
          >
            {generating ? 'Generating...' : 'Generate Maps'}
          </Button>

          {/* Regenerate with updated config using the last uploaded image */}
          {lastGeneratedFile && !selectedFile && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={generating}
              onClick={handleRegenerate}
            >
              {generating ? 'Regenerating...' : 'Regenerate with Config'}
            </Button>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Previous generations</p>
          <div className="space-y-1">
            {sessions.map((session) => {
              const value = `${API_PREFIX}${session.session_id}`
              const isSelected = selectedBundle === value
              return (
                <div
                  key={session.session_id}
                  className={`flex items-center justify-between rounded-md px-2 py-1 cursor-pointer text-xs transition-colors ${
                    isSelected
                      ? 'bg-primary/10 text-foreground'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  onClick={() => handleSessionSelect(session)}
                >
                  <span className="truncate mr-2">
                    {formatSourceImage(session.source_image)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] opacity-60">
                      {formatTime(session.created_at)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => handleSessionDelete(e, session.session_id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
