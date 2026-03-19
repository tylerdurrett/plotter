import * as React from 'react'
import { cn } from '@/lib/utils'

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  disabled?: boolean
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined)

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children?: React.ReactNode
}

function Select({ value, defaultValue, onValueChange, disabled, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '')
  const [open, setOpen] = React.useState(false)

  const currentValue = value !== undefined ? value : internalValue

  const handleValueChange = (newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
    setOpen(false)
  }

  return (
    <SelectContext.Provider value={{
      value: currentValue,
      onValueChange: handleValueChange,
      open,
      setOpen,
      disabled
    }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error('SelectTrigger must be used within Select')

    return (
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={context.open}
        aria-disabled={context.disabled}
        disabled={context.disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm',
          'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        onClick={() => !context.disabled && context.setOpen(!context.open)}
        {...props}
      >
        {children}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="opacity-50"
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    )
  }
)
SelectTrigger.displayName = 'SelectTrigger'

function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectValue must be used within Select')

  // Find the selected item's label
  const [label, setLabel] = React.useState<string | null>(null)

  React.useEffect(() => {
    // This will be set by SelectItem when it mounts
    const selectedElement = document.querySelector(`[data-value="${context.value}"]`)
    if (selectedElement) {
      setLabel(selectedElement.textContent || null)
    }
  }, [context.value])

  return <span>{label || placeholder || 'Select...'}</span>
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

function SelectContent({ className, children, ...props }: SelectContentProps) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectContent must be used within Select')

  if (!context.open) return null

  return (
    <div
      className={cn(
        'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      data-state={context.open ? 'open' : 'closed'}
      {...props}
    >
      {children}
    </div>
  )
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  children?: React.ReactNode
}

function SelectItem({ className, value, children, ...props }: SelectItemProps) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error('SelectItem must be used within Select')

  const isSelected = context.value === value

  return (
    <div
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        isSelected && 'bg-accent text-accent-foreground',
        className
      )}
      data-value={value}
      onClick={() => context.onValueChange(value)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }