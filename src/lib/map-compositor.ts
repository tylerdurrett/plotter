/**
 * Client-side composition engine for intermediate pipeline maps.
 *
 * Takes 9 raw intermediate Float32Arrays from the server and composites
 * them into the 7 final maps that sketches consume. This enables realtime
 * slider-driven remixing without server round-trips.
 *
 * All math replicates the Python pipeline composition exactly:
 * - portrait_map_lab/compose.py (density composition)
 * - portrait_map_lab/combine.py (importance blending)
 * - portrait_map_lab/flow_fields.py (flow alignment + blending)
 * - portrait_map_lab/flow_speed.py (speed derivation)
 */

import type { CompositionParams } from '@/lib/types'

export interface CompositorInputs {
  featureInfluence: Float32Array
  contourInfluence: Float32Array
  tonal: Float32Array
  etfFlowX: Float32Array
  etfFlowY: Float32Array
  contourFlowX: Float32Array
  contourFlowY: Float32Array
  coherence: Float32Array
  complexity: Float32Array
  width: number
  height: number
}

export interface CompositorOutputs {
  densityTarget: Float32Array
  importance: Float32Array
  flowX: Float32Array
  flowY: Float32Array
  coherence: Float32Array
  complexity: Float32Array
  flowSpeed: Float32Array
}

export const DEFAULT_COMPOSITION_PARAMS: CompositionParams = {
  featureWeight: 0.6,
  contourWeight: 0.4,
  blendMode: 'multiply',
  gamma: 1.0,
  coherencePower: 2.0,
  fallbackThreshold: 0.1,
  speedMin: 0.3,
  speedMax: 1.0,
}

/** Pre-allocate output arrays for reuse across recompositions. */
export function allocateOutputs(pixelCount: number): CompositorOutputs {
  return {
    densityTarget: new Float32Array(pixelCount),
    importance: new Float32Array(pixelCount),
    flowX: new Float32Array(pixelCount),
    flowY: new Float32Array(pixelCount),
    coherence: new Float32Array(pixelCount),
    complexity: new Float32Array(pixelCount),
    flowSpeed: new Float32Array(pixelCount),
  }
}

/**
 * Composite intermediate maps into final outputs in a single pass.
 *
 * Reuses pre-allocated output arrays when provided to avoid GC pressure.
 * Performance: ~1-2ms for 640×480 (307,200 pixels).
 */
export function composite(
  inputs: CompositorInputs,
  params: CompositionParams,
  out?: CompositorOutputs,
): CompositorOutputs {
  const n = inputs.width * inputs.height
  const result = out ?? allocateOutputs(n)

  const {
    featureInfluence, contourInfluence, tonal,
    etfFlowX, etfFlowY, contourFlowX, contourFlowY,
    coherence, complexity,
  } = inputs

  const {
    featureWeight: fw, contourWeight: cw,
    blendMode, gamma,
    coherencePower, fallbackThreshold,
    speedMin, speedMax,
  } = params

  // Pre-compute weight normalization (matches Python combine.py: sum of abs(weights))
  const totalWeight = Math.abs(fw) + Math.abs(cw)
  const invTotalWeight = totalWeight > 0 ? 1 / totalWeight : 0

  const speedRange = speedMax - speedMin
  const applyGamma = gamma !== 1.0

  for (let i = 0; i < n; i++) {
    // --- 1. Importance: weighted normalized blend ---
    // Matches: portrait_map_lab/combine.py combine_maps()
    const imp = Math.min(1, Math.max(0,
      (featureInfluence[i] * fw + contourInfluence[i] * cw) * invTotalWeight,
    ))
    result.importance[i] = imp

    // --- 2. Density: blend tonal + importance, then gamma ---
    // Matches: portrait_map_lab/compose.py compose_maps() + build_density_target()
    const t = tonal[i]
    let density: number
    switch (blendMode) {
      case 'multiply': density = t * imp; break
      case 'screen':   density = 1 - (1 - t) * (1 - imp); break
      case 'max':      density = t > imp ? t : imp; break
      case 'weighted': density = (t + imp) * 0.5; break
      default:         density = t * imp; break
    }
    if (applyGamma) density = Math.pow(density, gamma)
    result.densityTarget[i] = Math.min(1, Math.max(0, density))

    // --- 3. Flow: align ETF to contour, blend by coherence ---
    // Matches: portrait_map_lab/flow_fields.py
    //   align_tangent_field() + compute_blend_weight() + blend_flow_fields()
    const alpha = Math.pow(coherence[i], coherencePower)

    const cfx = contourFlowX[i]
    const cfy = contourFlowY[i]
    let efx = etfFlowX[i]
    let efy = etfFlowY[i]

    // Align: flip ETF where dot product with contour flow is negative
    // (resolves 180° ambiguity in tangent field)
    const dot = efx * cfx + efy * cfy
    if (dot < 0) { efx = -efx; efy = -efy }

    // Linear blend
    let bx = alpha * efx + (1 - alpha) * cfx
    let by = alpha * efy + (1 - alpha) * cfy
    let mag = Math.sqrt(bx * bx + by * by)

    // Fallback: use pure contour flow when vectors nearly cancel
    if (mag < fallbackThreshold) {
      bx = cfx; by = cfy
      mag = Math.sqrt(bx * bx + by * by)
    }

    // Normalize to unit length
    const safeMag = mag > 1e-10 ? mag : 1e-10
    result.flowX[i] = bx / safeMag
    result.flowY[i] = by / safeMag

    // --- 4. Flow speed: inverse linear map from complexity ---
    // Matches: portrait_map_lab/flow_speed.py compute_flow_speed()
    result.flowSpeed[i] = Math.min(speedMax, Math.max(speedMin,
      speedMax - complexity[i] * speedRange,
    ))
  }

  // Pass-through maps — bulk copy is faster than per-pixel assignment
  result.coherence.set(coherence)
  result.complexity.set(complexity)

  return result
}
