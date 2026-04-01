import { useState, useEffect } from 'react'
import type { MapBundleInfo } from '@/plugins/vite-plugin-maps'

interface MapPreviewProps {
  bundleInfo?: MapBundleInfo | null
  loading?: boolean
  /** Message shown when no bundleInfo is available (defaults to "No map selected") */
  emptyMessage?: string
  /** Override preview URL (e.g. for API-generated sessions) */
  previewUrl?: string
}

export function MapPreview({ bundleInfo, loading = false, emptyMessage = 'No map selected', previewUrl }: MapPreviewProps) {
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  // Reset loading state when preview source changes
  useEffect(() => {
    if (bundleInfo || previewUrl) {
      // Use a microtask to avoid synchronous setState
      Promise.resolve().then(() => {
        setImageLoading(true)
        setImageError(false)
      })
    }
  }, [bundleInfo, previewUrl])

  const handleImageLoad = () => {
    setImageLoading(false)
    setImageError(false)
  }

  const handleImageError = () => {
    setImageLoading(false)
    setImageError(true)
  }

  if (loading) {
    return (
      <div className="p-3 border-t border-border">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Map Preview
        </h3>
        <div className="bg-secondary rounded-md h-[150px] flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const resolvedUrl = previewUrl ?? bundleInfo?.previewUrl

  if (!resolvedUrl) {
    return (
      <div className="p-3 border-t border-border">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Map Preview
        </h3>
        <div className="bg-secondary rounded-md h-[150px] flex items-center justify-center">
          <p className="text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 border-t border-border">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
        Map Preview
      </h3>
      <div className="relative bg-secondary rounded-md overflow-hidden">
        {(imageLoading || imageError) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">
              {imageError ? 'Failed to load preview' : 'Loading preview...'}
            </p>
          </div>
        )}
        <img
          src={resolvedUrl}
          alt={`Preview of ${bundleInfo?.name ?? 'API'} map bundle`}
          className="w-full h-[150px] object-contain"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ display: imageError ? 'none' : 'block' }}
        />
      </div>
      {bundleInfo && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {bundleInfo.name}
        </p>
      )}
    </div>
  )
}