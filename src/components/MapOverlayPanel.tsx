import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import type { MapBundleInfo } from '@/plugins/vite-plugin-maps'

interface MapOverlayPanelProps {
  visible: boolean
  onVisibilityChange: (visible: boolean) => void
  mapKey: string
  onMapKeyChange: (key: string) => void
  opacity: number
  onOpacityChange: (opacity: number) => void
  bundleInfo?: MapBundleInfo
}

// Available preview map types with display names
const MAP_OPTIONS = [
  { value: 'density_target', label: 'Density Target', category: 'density' },
  { value: 'flow_lic', label: 'Flow LIC', category: 'flow' },
  { value: 'flow_speed', label: 'Flow Speed', category: 'flow' },
  { value: 'complexity', label: 'Complexity', category: 'complexity' },
  { value: 'importance', label: 'Importance', category: 'density' },
  { value: 'luminance', label: 'Luminance', category: 'density' },
  { value: 'etf_coherence', label: 'ETF Coherence', category: 'flow' },
  { value: 'flow_quiver', label: 'Flow Quiver', category: 'flow' },
] as const

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
            disabled={!visible}
          >
            <SelectTrigger id="overlay-map" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
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

// Export the map options for use in image loading
export { MAP_OPTIONS }