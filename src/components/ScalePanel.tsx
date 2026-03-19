import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

interface ScalePanelProps {
  scale: number
  onScaleChange: (scale: number) => void
}

export function ScalePanel({ scale, onScaleChange }: ScalePanelProps) {
  const handleScaleChange = (values: number[]) => {
    if (values.length > 0) {
      onScaleChange(values[0])
    }
  }

  const percentage = Math.round(scale * 100)

  return (
    <div className="p-3 border-t border-border">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        View
      </h3>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="view-scale" className="text-xs text-muted-foreground">
            Scale
          </Label>
          <span className="text-xs text-muted-foreground">
            {percentage}%
          </span>
        </div>
        <Slider
          id="view-scale"
          min={0.25}
          max={4.0}
          step={0.1}
          value={[scale]}
          onValueChange={handleScaleChange}
          className="py-2"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground/50">
          <span>25%</span>
          <span>100%</span>
          <span>400%</span>
        </div>
      </div>
    </div>
  )
}