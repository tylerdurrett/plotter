import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import type { MapBundleInfo, PreviewInfo } from '@/plugins/vite-plugin-maps'

interface MapOverlayPanelProps {
  visible: boolean
  onVisibilityChange: (visible: boolean) => void
  mapKey: string
  onMapKeyChange: (key: string) => void
  opacity: number
  onOpacityChange: (opacity: number) => void
  bundleInfo?: MapBundleInfo
}

// Helper to format preview names for display
function formatPreviewName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Group previews by category
function groupPreviewsByCategory(previews: PreviewInfo[]): Record<string, PreviewInfo[]> {
  return previews.reduce((groups, preview) => {
    const category = preview.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(preview)
    return groups
  }, {} as Record<string, PreviewInfo[]>)
}

export function MapOverlayPanel({
  visible,
  onVisibilityChange,
  mapKey,
  onMapKeyChange,
  opacity,
  onOpacityChange,
  bundleInfo,
}: MapOverlayPanelProps) {
  if (!bundleInfo) {
    return null
  }

  const handleVisibilityChange = (checked: boolean) => {
    onVisibilityChange(checked)
  }

  const handleOpacityChange = (values: number[]) => {
    if (values.length > 0) {
      onOpacityChange(values[0])
    }
  }

  // Use dynamic previews if available, otherwise fall back to empty array
  const availablePreviews = bundleInfo.availablePreviews || []
  const groupedPreviews = groupPreviewsByCategory(availablePreviews)

  return (
    <div className="p-3 border-t border-border">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        Map Overlay
      </h3>

      <div className="space-y-3">
        {/* Visibility Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="overlay-visible"
            checked={visible}
            onCheckedChange={handleVisibilityChange}
          />
          <Label
            htmlFor="overlay-visible"
            className="text-sm font-normal cursor-pointer"
          >
            Show overlay
          </Label>
        </div>

        {/* Map Selection */}
        <div className="space-y-1">
          <Label htmlFor="overlay-map" className="text-xs text-muted-foreground">
            Preview Map
          </Label>
          <Select
            value={mapKey}
            onValueChange={onMapKeyChange}
            disabled={!visible || availablePreviews.length === 0}
          >
            <SelectTrigger id="overlay-map" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupedPreviews).map(([category, previews]) => (
                <div key={category}>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {formatPreviewName(category)}
                  </div>
                  {previews.map((preview) => (
                    <SelectItem key={preview.path} value={preview.path}>
                      {formatPreviewName(preview.name)}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Opacity Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="overlay-opacity" className="text-xs text-muted-foreground">
              Opacity
            </Label>
            <span className="text-xs text-muted-foreground">
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <Slider
            id="overlay-opacity"
            min={0.1}
            max={0.8}
            step={0.05}
            value={[opacity]}
            onValueChange={handleOpacityChange}
            disabled={!visible}
            className="py-2"
          />
        </div>
      </div>
    </div>
  )
}