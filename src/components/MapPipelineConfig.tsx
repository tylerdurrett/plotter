import { useCallback, useState } from 'react'

import { Collapsible } from '@/components/ui/collapsible'
import { ConfigSlider } from '@/components/ui/config-slider'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { PipelineConfig, PreviewInfo } from '@/lib/map-api'

interface MapPipelineConfigProps {
  config: PipelineConfig
  onConfigChange: (config: PipelineConfig) => void
  disabled?: boolean
  /** Base URL for the active API session (e.g. http://…/api/maps/{id}). */
  previewBaseUrl?: string
  /** Available previews from the API session, used to validate existence. */
  previews?: PreviewInfo[]
  /** When true, hide composition controls (they live in MapMixPanel instead). */
  compositeMode?: boolean
}

/** Maps each section title to its representative preview. */
const PRIMARY_PREVIEWS: Record<string, { category: string; name: string }> = {
  Density:      { category: 'density',     name: 'density_target' },
  Features:     { category: 'features',    name: 'combined_importance' },
  Contour:      { category: 'contour',     name: 'contour_influence' },
  Flow:         { category: 'flow',        name: 'flow_lic' },
  Complexity:   { category: 'complexity',  name: 'complexity' },
  'Flow Speed': { category: 'flow',        name: 'flow_speed' },
}

function getStageThumbnailUrl(
  sectionTitle: string,
  previewBaseUrl?: string,
  previews?: PreviewInfo[],
): string | undefined {
  if (!previewBaseUrl) return undefined
  const mapping = PRIMARY_PREVIEWS[sectionTitle]
  if (!mapping) return undefined
  if (previews && !previews.some(p => p.category === mapping.category && p.name === mapping.name)) {
    return undefined
  }
  return `${previewBaseUrl}/previews/${mapping.category}/${mapping.name}.png`
}

function StageThumbnail({ src }: { src: string }) {
  const [error, setError] = useState(false)
  if (error) return null
  return (
    <img
      src={src}
      alt=""
      className="size-6 rounded-sm object-cover bg-secondary"
      onError={() => setError(true)}
    />
  )
}

export function MapPipelineConfig({
  config,
  onConfigChange,
  disabled = false,
  previewBaseUrl,
  previews,
  compositeMode = false,
}: MapPipelineConfigProps) {
  const update = useCallback(
    <K extends keyof PipelineConfig>(
      section: K,
      field: string,
      value: unknown,
    ) => {
      const prev = config[section] ?? {}
      onConfigChange({
        ...config,
        [section]: { ...prev, [field]: value },
      })
    },
    [config, onConfigChange],
  )

  const updateNested = useCallback(
    <K extends keyof PipelineConfig>(
      section: K,
      subsection: string,
      field: string,
      value: unknown,
    ) => {
      const prev = config[section] ?? ({} as Record<string, unknown>)
      const prevSub = (prev as Record<string, unknown>)[subsection] ?? {}
      onConfigChange({
        ...config,
        [section]: {
          ...prev,
          [subsection]: { ...(prevSub as Record<string, unknown>), [field]: value },
        },
      })
    },
    [config, onConfigChange],
  )

  const handleReset = useCallback(() => {
    onConfigChange({})
  }, [onConfigChange])

  const thumb = (title: string) => {
    const url = getStageThumbnailUrl(title, previewBaseUrl, previews)
    return url ? <StageThumbnail src={url} /> : undefined
  }

  const d = config.density ?? {}
  const f = config.features ?? {}
  const c = config.contour ?? {}
  const fl = config.flow ?? {}
  const cx = config.complexity ?? {}
  const fs = config.flow_speed ?? {}

  return (
    <div data-testid="map-pipeline-config" className="border-t border-border">
      <div className="p-3 pb-0">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          {compositeMode ? 'Compute' : 'Pipeline Config'}
          {compositeMode && <span className="text-[10px] normal-case font-normal opacity-60 ml-1">(regenerate)</span>}
        </h3>
      </div>

      {/* Density — hidden in composite mode (controls move to MapMixPanel) */}
      {!compositeMode && (
        <Collapsible title="Density" defaultOpen headerRight={thumb('Density')}>
          <ConfigSlider
            label="Gamma"
            value={d.gamma}
            defaultValue={1.0}
            min={0.1}
            max={3.0}
            step={0.05}
            onChange={(v) => update('density', 'gamma', v)}
            disabled={disabled}
          />
          <ConfigSlider
            label="Feature Weight"
            value={d.feature_weight}
            defaultValue={1.0}
            min={0}
            max={2.0}
            step={0.05}
            onChange={(v) => update('density', 'feature_weight', v)}
            disabled={disabled}
          />
          <ConfigSlider
            label="Contour Weight"
            value={d.contour_weight}
            defaultValue={0.5}
            min={0}
            max={2.0}
            step={0.05}
            onChange={(v) => update('density', 'contour_weight', v)}
            disabled={disabled}
          />
          <ConfigSlider
            label="Tonal Weight"
            value={d.tonal_weight}
            defaultValue={1.0}
            min={0}
            max={2.0}
            step={0.05}
            onChange={(v) => update('density', 'tonal_weight', v)}
            disabled={disabled}
          />
          <ConfigSlider
            label="Importance Weight"
            value={d.importance_weight}
            defaultValue={1.0}
            min={0}
            max={2.0}
            step={0.05}
            onChange={(v) => update('density', 'importance_weight', v)}
            disabled={disabled}
          />
        </Collapsible>
      )}

      {/* Features */}
      <Collapsible title="Features" headerRight={thumb('Features')}>
        <ConfigSlider
          label="Eyes Weight"
          value={f.weights?.eyes}
          defaultValue={1.0}
          min={0}
          max={3.0}
          step={0.1}
          onChange={(v) => updateNested('features', 'weights', 'eyes', v)}
          disabled={disabled}
        />
        <ConfigSlider
          label="Mouth Weight"
          value={f.weights?.mouth}
          defaultValue={0.5}
          min={0}
          max={2.0}
          step={0.1}
          onChange={(v) => updateNested('features', 'weights', 'mouth', v)}
          disabled={disabled}
        />
      </Collapsible>

      {/* Contour */}
      <Collapsible title="Contour" headerRight={thumb('Contour')}>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Direction</Label>
          <Select
            value={c.direction ?? 'inward'}
            onValueChange={(v) => update('contour', 'direction', v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inward">Inward</SelectItem>
              <SelectItem value="outward">Outward</SelectItem>
              <SelectItem value="both">Both</SelectItem>
              <SelectItem value="band">Band</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ConfigSlider
          label="Thickness"
          value={c.contour_thickness}
          defaultValue={3}
          min={1}
          max={10}
          step={1}
          onChange={(v) => update('contour', 'contour_thickness', v)}
          disabled={disabled}
        />
      </Collapsible>

      {/* Flow — in composite mode, coherence_power and blend_mode move to MapMixPanel */}
      <Collapsible title="Flow" headerRight={thumb('Flow')}>
        <ConfigSlider
          label="ETF Blur Sigma"
          value={fl.etf?.blur_sigma}
          defaultValue={5.0}
          min={0.5}
          max={15.0}
          step={0.5}
          onChange={(v) => updateNested('flow', 'etf', 'blur_sigma', v)}
          disabled={disabled}
        />
        <ConfigSlider
          label="ETF Refine Iterations"
          value={fl.etf?.refine_iterations}
          defaultValue={4}
          min={1}
          max={10}
          step={1}
          onChange={(v) => updateNested('flow', 'etf', 'refine_iterations', v)}
          disabled={disabled}
        />
        {!compositeMode && (
          <>
            <ConfigSlider
              label="Coherence Power"
              value={fl.coherence_power}
              defaultValue={2.0}
              min={0.5}
              max={5.0}
              step={0.1}
              onChange={(v) => update('flow', 'coherence_power', v)}
              disabled={disabled}
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Blend Mode</Label>
              <Select
                value={fl.blend_mode ?? 'slerp'}
                onValueChange={(v) => update('flow', 'blend_mode', v)}
                disabled={disabled}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slerp">Slerp</SelectItem>
                  <SelectItem value="average">Average</SelectItem>
                  <SelectItem value="dominant">Dominant</SelectItem>
                  <SelectItem value="weighted">Weighted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </Collapsible>

      {/* Complexity */}
      <Collapsible title="Complexity" headerRight={thumb('Complexity')}>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Metric</Label>
          <Select
            value={cx.metric ?? 'gradient'}
            onValueChange={(v) => update('complexity', 'metric', v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gradient">Gradient</SelectItem>
              <SelectItem value="laplacian">Laplacian</SelectItem>
              <SelectItem value="multiscale_gradient">Multiscale Gradient</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ConfigSlider
          label="Sigma"
          value={cx.sigma}
          defaultValue={3.0}
          min={0.5}
          max={10.0}
          step={0.5}
          onChange={(v) => update('complexity', 'sigma', v)}
          disabled={disabled}
        />
      </Collapsible>

      {/* Flow Speed — hidden in composite mode (controls move to MapMixPanel) */}
      {!compositeMode && (
        <Collapsible title="Flow Speed" headerRight={thumb('Flow Speed')}>
          <ConfigSlider
            label="Speed Min"
            value={fs.speed_min}
            defaultValue={0.2}
            min={0}
            max={1.0}
            step={0.05}
            onChange={(v) => update('flow_speed', 'speed_min', v)}
            disabled={disabled}
          />
          <ConfigSlider
            label="Speed Max"
            value={fs.speed_max}
            defaultValue={1.0}
            min={0}
            max={1.0}
            step={0.05}
            onChange={(v) => update('flow_speed', 'speed_max', v)}
            disabled={disabled}
          />
        </Collapsible>
      )}

      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={handleReset}
          disabled={disabled}
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  )
}
