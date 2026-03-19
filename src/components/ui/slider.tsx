import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value?: number[]
  defaultValue?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({
    className,
    value,
    defaultValue = [0],
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    disabled,
    ...props
  }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const currentValue = value !== undefined ? value : internalValue

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = [parseFloat(e.target.value)]
      if (value === undefined) {
        setInternalValue(newValue)
      }
      onValueChange?.(newValue)
    }

    const percentage = ((currentValue[0] - min) / (max - min)) * 100

    return (
      <div className={cn('relative flex w-full touch-none select-none items-center', className)}>
        <div className="relative w-full h-2">
          <div className="absolute inset-0 rounded-full bg-secondary" />
          <div
            className="absolute h-full rounded-full bg-primary"
            style={{ width: `${percentage}%` }}
          />
          <input
            ref={ref}
            type="range"
            role="slider"
            aria-disabled={disabled}
            min={min}
            max={max}
            step={step}
            value={currentValue[0]}
            onChange={handleChange}
            disabled={disabled}
            className={cn(
              'absolute inset-0 w-full cursor-pointer opacity-0',
              'disabled:cursor-not-allowed',
            )}
            {...props}
          />
          <div
            className={cn(
              'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
            style={{ left: `calc(${percentage}% - 10px)` }}
          />
        </div>
      </div>
    )
  }
)
Slider.displayName = 'Slider'

export { Slider }