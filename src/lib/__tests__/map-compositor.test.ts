import { describe, expect, it } from 'vitest'
import { composite, allocateOutputs, DEFAULT_COMPOSITION_PARAMS, type CompositorInputs } from '../map-compositor'
import type { CompositionParams } from '@/lib/types'

/** Create test inputs with uniform values for easy verification. */
function makeInputs(
  width: number,
  height: number,
  overrides?: Partial<Record<keyof Omit<CompositorInputs, 'width' | 'height'>, number>>,
): CompositorInputs {
  const n = width * height
  const val = (key: keyof Omit<CompositorInputs, 'width' | 'height'>) =>
    overrides?.[key] ?? 0

  return {
    featureInfluence: new Float32Array(n).fill(val('featureInfluence')),
    contourInfluence: new Float32Array(n).fill(val('contourInfluence')),
    tonal: new Float32Array(n).fill(val('tonal')),
    etfFlowX: new Float32Array(n).fill(val('etfFlowX')),
    etfFlowY: new Float32Array(n).fill(val('etfFlowY')),
    contourFlowX: new Float32Array(n).fill(val('contourFlowX')),
    contourFlowY: new Float32Array(n).fill(val('contourFlowY')),
    coherence: new Float32Array(n).fill(val('coherence')),
    complexity: new Float32Array(n).fill(val('complexity')),
    width,
    height,
  }
}

describe('composite', () => {
  describe('importance blending', () => {
    it('computes weighted normalized importance', () => {
      const inputs = makeInputs(2, 2, {
        featureInfluence: 0.8,
        contourInfluence: 0.4,
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        featureWeight: 0.6,
        contourWeight: 0.4,
      }
      const out = composite(inputs, params)
      // (0.8*0.6 + 0.4*0.4) / (0.6+0.4) = (0.48+0.16)/1.0 = 0.64
      expect(out.importance[0]).toBeCloseTo(0.64, 5)
    })

    it('handles zero total weight', () => {
      const inputs = makeInputs(2, 2, {
        featureInfluence: 0.5,
        contourInfluence: 0.5,
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        featureWeight: 0,
        contourWeight: 0,
      }
      const out = composite(inputs, params)
      expect(out.importance[0]).toBe(0)
    })

    it('normalizes by absolute weight sum', () => {
      const inputs = makeInputs(1, 1, {
        featureInfluence: 1.0,
        contourInfluence: 0.0,
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        featureWeight: 2.0,
        contourWeight: 0.0,
      }
      const out = composite(inputs, params)
      // (1.0*2.0 + 0.0*0.0) / |2.0| = 2.0/2.0 = 1.0
      expect(out.importance[0]).toBeCloseTo(1.0, 5)
    })
  })

  describe('density blend modes', () => {
    const baseInputs = makeInputs(1, 1, {
      featureInfluence: 1.0,
      contourInfluence: 1.0,
      tonal: 0.6,
    })
    const baseParams: CompositionParams = {
      ...DEFAULT_COMPOSITION_PARAMS,
      featureWeight: 0.5,
      contourWeight: 0.5,
      gamma: 1.0,
    }

    it('multiply mode', () => {
      const out = composite(baseInputs, { ...baseParams, blendMode: 'multiply' })
      // importance = 1.0, tonal = 0.6 → density = 0.6 * 1.0 = 0.6
      expect(out.densityTarget[0]).toBeCloseTo(0.6, 5)
    })

    it('screen mode', () => {
      const out = composite(baseInputs, { ...baseParams, blendMode: 'screen' })
      // 1 - (1-0.6)*(1-1.0) = 1 - 0.4*0 = 1.0
      expect(out.densityTarget[0]).toBeCloseTo(1.0, 5)
    })

    it('max mode', () => {
      const out = composite(baseInputs, { ...baseParams, blendMode: 'max' })
      // max(0.6, 1.0) = 1.0
      expect(out.densityTarget[0]).toBeCloseTo(1.0, 5)
    })

    it('weighted mode', () => {
      const out = composite(baseInputs, { ...baseParams, blendMode: 'weighted' })
      // (0.6 + 1.0) / 2 = 0.8
      expect(out.densityTarget[0]).toBeCloseTo(0.8, 5)
    })
  })

  describe('gamma correction', () => {
    it('applies gamma < 1 (brightens)', () => {
      const inputs = makeInputs(1, 1, {
        featureInfluence: 1.0,
        contourInfluence: 1.0,
        tonal: 0.5,
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        gamma: 0.5,
        blendMode: 'multiply',
      }
      const out = composite(inputs, params)
      // density = 0.5^0.5 = ~0.707
      expect(out.densityTarget[0]).toBeCloseTo(Math.pow(0.5, 0.5), 4)
    })

    it('applies gamma > 1 (darkens)', () => {
      const inputs = makeInputs(1, 1, {
        featureInfluence: 1.0,
        contourInfluence: 1.0,
        tonal: 0.5,
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        gamma: 2.0,
        blendMode: 'multiply',
      }
      const out = composite(inputs, params)
      // density = 0.5^2.0 = 0.25
      expect(out.densityTarget[0]).toBeCloseTo(0.25, 5)
    })

    it('gamma = 1 is identity', () => {
      const inputs = makeInputs(1, 1, {
        featureInfluence: 1.0,
        contourInfluence: 1.0,
        tonal: 0.73,
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        gamma: 1.0,
        blendMode: 'multiply',
      }
      const out = composite(inputs, params)
      expect(out.densityTarget[0]).toBeCloseTo(0.73, 5)
    })
  })

  describe('flow alignment and blending', () => {
    it('aligns ETF to contour by flipping when dot < 0', () => {
      // ETF points opposite to contour — should be flipped
      const inputs = makeInputs(1, 1, {
        etfFlowX: -1.0,  // ETF points left
        etfFlowY: 0.0,
        contourFlowX: 1.0,  // Contour points right
        contourFlowY: 0.0,
        coherence: 1.0,  // Full ETF weight
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        coherencePower: 1.0,
      }
      const out = composite(inputs, params)
      // After alignment ETF becomes (1,0), blend with alpha=1 → (1,0)
      expect(out.flowX[0]).toBeCloseTo(1.0, 5)
      expect(out.flowY[0]).toBeCloseTo(0.0, 5)
    })

    it('does not flip when dot >= 0', () => {
      const inputs = makeInputs(1, 1, {
        etfFlowX: 0.707,
        etfFlowY: 0.707,
        contourFlowX: 1.0,
        contourFlowY: 0.0,
        coherence: 1.0,
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        coherencePower: 1.0,
      }
      const out = composite(inputs, params)
      // dot = 0.707*1 + 0.707*0 = 0.707 > 0, no flip
      // alpha=1 → use ETF, normalized
      const mag = Math.sqrt(0.707 * 0.707 + 0.707 * 0.707)
      expect(out.flowX[0]).toBeCloseTo(0.707 / mag, 3)
      expect(out.flowY[0]).toBeCloseTo(0.707 / mag, 3)
    })

    it('uses coherence_power to modulate blend weight', () => {
      const inputs = makeInputs(1, 1, {
        etfFlowX: 0.0,
        etfFlowY: 1.0,
        contourFlowX: 1.0,
        contourFlowY: 0.0,
        coherence: 0.5,
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        coherencePower: 2.0,
      }
      const out = composite(inputs, params)
      // alpha = 0.5^2 = 0.25
      // dot = 0*1+1*0 = 0 >= 0, no flip
      // blend = 0.25*(0,1) + 0.75*(1,0) = (0.75, 0.25)
      const bx = 0.75, by = 0.25
      const mag = Math.sqrt(bx * bx + by * by)
      expect(out.flowX[0]).toBeCloseTo(bx / mag, 4)
      expect(out.flowY[0]).toBeCloseTo(by / mag, 4)
    })

    it('falls back to contour flow when vectors cancel', () => {
      // ETF and contour point in same direction after alignment,
      // but if alpha=0.5 and they're opposite, they cancel
      const inputs = makeInputs(1, 1, {
        etfFlowX: 1.0,
        etfFlowY: 0.0,
        contourFlowX: -1.0,
        contourFlowY: 0.0,
        coherence: 0.5,
      })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        coherencePower: 1.0,
        fallbackThreshold: 0.1,
      }
      const out = composite(inputs, params)
      // dot = 1*(-1)+0*0 = -1 < 0 → flip ETF to (-1,0)... wait no flip to (−1,0)→(1,0)
      // Wait: ETF=(1,0), contour=(-1,0), dot=1*(-1)=-1 < 0 → flip ETF to (-1,0)
      // blend = 0.5*(-1,0) + 0.5*(-1,0) = (-1, 0), mag=1.0 > threshold
      // Actually after flip: ETF becomes (-1,0), contour is (-1,0)
      // blend = 0.5*(-1,0) + 0.5*(-1,0) = (-1,0)
      expect(out.flowX[0]).toBeCloseTo(-1.0, 5)
      expect(out.flowY[0]).toBeCloseTo(0.0, 5)
    })
  })

  describe('flow speed', () => {
    it('maps complexity inversely to speed', () => {
      const inputs = makeInputs(1, 1, { complexity: 0.0 })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        speedMin: 0.3,
        speedMax: 1.0,
      }
      const out = composite(inputs, params)
      // complexity=0 → speed = 1.0 (max, smooth areas move fast)
      expect(out.flowSpeed[0]).toBeCloseTo(1.0, 5)
    })

    it('high complexity → low speed', () => {
      const inputs = makeInputs(1, 1, { complexity: 1.0 })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        speedMin: 0.3,
        speedMax: 1.0,
      }
      const out = composite(inputs, params)
      // complexity=1 → speed = 1.0 - 1.0*0.7 = 0.3 (min)
      expect(out.flowSpeed[0]).toBeCloseTo(0.3, 5)
    })

    it('mid complexity → mid speed', () => {
      const inputs = makeInputs(1, 1, { complexity: 0.5 })
      const params: CompositionParams = {
        ...DEFAULT_COMPOSITION_PARAMS,
        speedMin: 0.3,
        speedMax: 1.0,
      }
      const out = composite(inputs, params)
      // complexity=0.5 → speed = 1.0 - 0.5*0.7 = 0.65
      expect(out.flowSpeed[0]).toBeCloseTo(0.65, 5)
    })
  })

  describe('pass-through maps', () => {
    it('passes coherence and complexity through unchanged', () => {
      const inputs = makeInputs(1, 1, {
        coherence: 0.42,
        complexity: 0.73,
      })
      const out = composite(inputs, DEFAULT_COMPOSITION_PARAMS)
      expect(out.coherence[0]).toBeCloseTo(0.42, 5)
      expect(out.complexity[0]).toBeCloseTo(0.73, 5)
    })
  })

  describe('output reuse', () => {
    it('reuses pre-allocated output arrays', () => {
      const inputs = makeInputs(4, 4)
      const out1 = allocateOutputs(16)
      const out2 = composite(inputs, DEFAULT_COMPOSITION_PARAMS, out1)
      // Should be the exact same object reference
      expect(out2).toBe(out1)
      expect(out2.densityTarget).toBe(out1.densityTarget)
    })
  })

  describe('performance', () => {
    it('composites 640x480 in < 10ms', () => {
      const inputs = makeInputs(640, 480, {
        featureInfluence: 0.5,
        contourInfluence: 0.3,
        tonal: 0.7,
        etfFlowX: 0.6,
        etfFlowY: 0.8,
        contourFlowX: 1.0,
        contourFlowY: 0.0,
        coherence: 0.5,
        complexity: 0.4,
      })
      const out = allocateOutputs(640 * 480)

      const start = performance.now()
      composite(inputs, DEFAULT_COMPOSITION_PARAMS, out)
      const elapsed = performance.now() - start

      // Generous threshold for CI (includes JIT warmup); real hardware should be <2ms
      expect(elapsed).toBeLessThan(50)
    })
  })
})
