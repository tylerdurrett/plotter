import type { MapBundle } from './maps'

/** 2D vector / point tuple */
export type Vec2 = [number, number]

/** 3D vector tuple */
export type Vec3 = [number, number, number]

/** Alias for Vec2 — compatible everywhere Vec2 is used */
export type Point = Vec2

/** Array of points forming a polyline path */
export type Polyline = Point[]

/** Paper dimensions in centimeters */
export interface PaperSize {
  width: number
  height: number
}

/** Physical length unit */
export type LengthUnit = 'cm' | 'in' | 'mm'

/** Seeded random number generator instance */
export interface Random {
  /** Uniform random value in [0, 1) */
  value(): number
  /** Uniform random float in [min, max) */
  range(min: number, max: number): number
  /** Random integer in [min, max) */
  rangeFloor(min: number, max: number): number
  /** Normal distribution via Box-Muller transform */
  gaussian(mean?: number, std?: number): number
  /** 50/50 boolean */
  boolean(): boolean
  /** Random element from array */
  pick<T>(array: readonly T[]): T
  /** Fisher-Yates shuffle (returns new array, no mutation) */
  shuffle<T>(array: readonly T[]): T[]
  /** Random point on circle perimeter */
  onCircle(radius?: number): Vec2
  /** Random point inside circle */
  insideCircle(radius?: number): Vec2
  /** 2D simplex noise seeded to this instance */
  noise2D(x: number, y: number): number
  /** 3D simplex noise seeded to this instance */
  noise3D(x: number, y: number, z: number): number
}

/** Context provided to sketch render/setup functions */
export interface SketchContext {
  /** Effective drawing width in cm (paper width minus margins) */
  width: number
  /** Effective drawing height in cm (paper height minus margins) */
  height: number
  /** Factory for creating seeded random instances */
  createRandom(seed: string | number): Random
  /** Paper metadata */
  paper: PaperSize & {
    name: string
    margin: number
  }
  /** Optional map bundle for map-driven drawing */
  maps?: MapBundle
}

/** Sketch module contract — every sketch file must satisfy this interface */
export interface SketchModule {
  /** Leva-compatible parameter schema */
  params: Record<string, unknown>
  /** One-time initialization (called once after load, not on every param change) */
  setup?(ctx: SketchContext): void
  /** Generate polylines from context and current param values */
  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[]
}

/** Options for SVG export */
export interface ExportOptions extends PaperSize {
  /** Output units for SVG dimensions */
  units: LengthUnit
  /** Stroke width in paper units (default 0.03 cm ≈ fine pen) */
  strokeWidth: number
  /** CSS color string (default 'black') */
  strokeColor: string
}

/** Map keys available in map bundles */
export type MapKey =
  | 'density_target'
  | 'flow_x'
  | 'flow_y'
  | 'importance'
  | 'coherence'
  | 'complexity'
  | 'flow_speed'

/** Map coordinate fitting mode */
export type MapFitMode = 'cover' | 'fit'

/** Individual map metadata from manifest */
export interface MapInfo {
  filename: string
  key: MapKey
  dtype: string
  shape: [number, number]
  value_range: [number, number]
  description: string
}

/** Map bundle manifest structure */
export interface MapManifest {
  version: number
  source_image: string
  width: number
  height: number
  created_at: string
  maps: MapInfo[]
}
