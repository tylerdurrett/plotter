import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { LevaPanel, useControls, useCreateStore } from 'leva'

import { extractParamValues } from '@/lib/params'

export interface ControlPanelProps {
  /** Leva-compatible param schema from the sketch module */
  params: Record<string, unknown>
  /** Called on every param value change (transient — does not trigger React re-render) */
  onChange: (values: Record<string, unknown>) => void
}

export interface ControlPanelHandle {
  /** Programmatically update param values (e.g. for Randomize Seed) */
  setValues: (values: Record<string, unknown>) => void
}

/** Dark theme matching shadcn CSS variables from index.css */
const LEVA_THEME = {
  colors: {
    elevation1: 'oklch(0.205 0 0)', // --card
    elevation2: 'oklch(0.269 0 0)', // --secondary
    elevation3: 'oklch(0.32 0 0)', // hover state
    accent1: 'oklch(0.488 0.243 264.376)', // --chart-4
    accent2: 'oklch(0.546 0.245 262.881)', // --chart-3
    accent3: 'oklch(0.623 0.214 259.815)', // --chart-2
    highlight1: 'oklch(0.556 0 0)', // labels
    highlight2: 'oklch(0.708 0 0)', // --muted-foreground
    highlight3: 'oklch(0.985 0 0)', // --foreground
  },
  fonts: {
    mono: "'Geist Variable', monospace",
    sans: "'Geist Variable', sans-serif",
  },
} as const

/**
 * Renders a Leva parameter panel for a sketch's param schema.
 *
 * Uses an isolated store and embedded `fill` mode so the panel
 * renders inline within its container (not as a floating overlay).
 * Changes are delivered via the transient `onChange` callback to
 * avoid full React re-renders on every slider drag.
 */
export const ControlPanel = forwardRef<ControlPanelHandle, ControlPanelProps>(
  function ControlPanel({ params, onChange }, ref) {
    const store = useCreateStore()

    // Track current values so we can deliver the full object on each change
    const valuesRef = useRef(extractParamValues(params))

    // Stable ref for the onChange prop so the schema callbacks always see
    // the latest handler without needing to rebuild the schema.
    const onChangeRef = useRef(onChange)
    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    // Expose setValues so the parent can programmatically update params
    // (e.g. Randomize Seed button). Uses Leva's store API to update both
    // the UI controls and trigger the onChange callback.
    useImperativeHandle(ref, () => ({
      setValues(values: Record<string, unknown>) {
        for (const [path, value] of Object.entries(values)) {
          store.setValueAtPath(path, value, false)
        }
      },
    }))

    // Leva extracts onChange from each *param definition* in the schema,
    // NOT from the settings object. Inject a transient onChange handler
    // into every param so slider drags propagate to the parent.
    useControls(
      () => {
        const schema: Record<string, unknown> = {}
        for (const [key, paramDef] of Object.entries(params)) {
          const handler = (
            value: unknown,
            _path: string,
            context: { initial: boolean },
          ) => {
            if (context.initial) return
            valuesRef.current[key] = value
            onChangeRef.current({ ...valuesRef.current })
          }

          if (paramDef && typeof paramDef === 'object') {
            schema[key] = {
              ...(paramDef as object),
              onChange: handler,
              transient: true,
            }
          } else {
            // Raw primitive — wrap in an object with onChange
            schema[key] = {
              value: paramDef,
              onChange: handler,
              transient: true,
            }
          }
        }
        return schema
      },
      { store },
    )

    return (
      <div data-testid="control-panel">
        <LevaPanel
          store={store}
          fill
          flat
          titleBar={false}
          hideCopyButton
          theme={LEVA_THEME}
        />
      </div>
    )
  },
)
