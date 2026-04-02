import { useCallback } from 'react'

import { Collapsible } from '@/components/ui/collapsible'
import { ConfigSlider } from '@/components/ui/config-slider'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { CompositionParams, DensityBlendMode } from '@/lib/types'
import { DEFAULT_COMPOSITION_PARAMS } from '@/lib/map-compositor'

interface MapMixPanelProps {
  params: CompositionParams
  onParamsChange: (params: CompositionParams) => void
  disabled?: boolean
}

/**
 * Realtime composition parameter panel.
 *
 * Changes here trigger instant client-side recomposition (~2ms)
 * without any server round-trip.
 */
export function MapMixPanel({
  params,
  onParamsChange,
  disabled = false,
}: MapMixPanelProps) {
  const update = useCallback(
    <K extends keyof CompositionParams>(field: K, value: CompositionParams[K]) => {
      onParamsChange({ ...params, [field]: value })
    },
    [params, onParamsChange],
  )

  const handleReset = useCallback(() => {
    onParamsChange({ ...DEFAULT_COMPOSITION_PARAMS })
  }, [onParamsChange])

  return (
    <div data-testid="map-mix-panel" className="border-t border-border">
      <div className="p-3 pb-0">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Mix <span className="text-[10px] normal-case font-normal opacity-60">(instant)</span>
        </h3>
      </div>

      <Collapsible title="Importance" defaultOpen>
        <ConfigSlider
          label="Feature Weight"
          value={params.featureWeight}
          min={0}
          max={2.0}
          step={0.05}
          onChange={(v) => update('featureWeight', v)}
          disabled={disabled}
        />
        <ConfigSlider
          label="Contour Weight"
          value={params.contourWeight}
          min={0}
          max={2.0}
          step={0.05}
          onChange={(v) => update('contourWeight', v)}
          disabled={disabled}
        />
      </Collapsible>

      <Collapsible title="Density" defaultOpen>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Blend Mode</Label>
          <Select
            value={params.blendMode}
            onValueChange={(v) => update('blendMode', v as DensityBlendMode)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiply">Multiply</SelectItem>
              <SelectItem value="screen">Screen</SelectItem>
              <SelectItem value="max">Max</SelectItem>
              <SelectItem value="weighted">Weighted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ConfigSlider
          label="Gamma"
          value={params.gamma}
          min={0.1}
          max={3.0}
          step={0.05}
          onChange={(v) => update('gamma', v)}
          disabled={disabled}
        />
      </Collapsible>

      <Collapsible title="Flow">
        <ConfigSlider
          label="Coherence Power"
          value={params.coherencePower}
          min={0.5}
          max={5.0}
          step={0.1}
          onChange={(v) => update('coherencePower', v)}
          disabled={disabled}
        />
      </Collapsible>

      <Collapsible title="Speed">
        <ConfigSlider
          label="Speed Min"
          value={params.speedMin}
          min={0}
          max={1.0}
          step={0.05}
          onChange={(v) => update('speedMin', v)}
          disabled={disabled}
        />
        <ConfigSlider
          label="Speed Max"
          value={params.speedMax}
          min={0}
          max={1.0}
          step={0.05}
          onChange={(v) => update('speedMax', v)}
          disabled={disabled}
        />
      </Collapsible>

      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={handleReset}
          disabled={disabled}
        >
          Reset Mix to Defaults
        </Button>
      </div>
    </div>
  )
}
