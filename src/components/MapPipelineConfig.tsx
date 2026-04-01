import { useCallback } from 'react'

import { Collapsible } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import type { PipelineConfig } from '@/lib/map-api'

interface MapPipelineConfigProps {
  config: PipelineConfig
  onConfigChange: (config: PipelineConfig) => void
  disabled?: boolean
}

/** Labeled slider with current value display. */
function ConfigSlider({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string
  value: number | undefined
  defaultValue: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const current = value ?? defaultValue

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{current.toFixed(2)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[current]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
        className="py-1"
      />
    </div>
  )
}

export function MapPipelineConfig({
  config,
  onConfigChange,
  disabled = false,
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
          Pipeline Config
        </h3>
      </div>

      {/* Density — most commonly tuned, open by default */}
      <Collapsible title="Density" defaultOpen>
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

      {/* Features */}
      <Collapsible title="Features">
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
      <Collapsible title="Contour">
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

      {/* Flow */}
      <Collapsible title="Flow">
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
      </Collapsible>

      {/* Complexity */}
      <Collapsible title="Complexity">
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

      {/* Flow Speed */}
      <Collapsible title="Flow Speed">
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
