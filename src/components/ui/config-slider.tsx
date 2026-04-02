import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

/** Labeled slider with current value display, used across pipeline config panels. */
export function ConfigSlider({
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
  value?: number
  defaultValue?: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const current = value ?? defaultValue ?? min

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
