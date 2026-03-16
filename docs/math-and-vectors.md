# Math & Vector Reference

This reference covers the scalar math utilities in `src/lib/math.ts` and the vector utilities in `src/lib/vec.ts`. Both modules are pure functions with no side effects or external dependencies.

## Scalar Math (`math.ts`)

Import individual functions:

```ts
import { lerp, clamp, mapRange, smoothstep } from '@/lib/math'
```

### Functions

| Function      | Signature                                        | Description                                                                                                   |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `lerp`        | `(a, b, t) → number`                             | Linear interpolation. Returns `a` when `t=0`, `b` when `t=1`. Extrapolates outside [0, 1].                    |
| `inverseLerp` | `(a, b, v) → number`                             | Inverse of lerp — returns the `t` that produces `v` in [a, b]. Returns 0 when `a === b`.                      |
| `clamp`       | `(value, min, max) → number`                     | Clamp value to the range [min, max].                                                                          |
| `mapRange`    | `(value, inMin, inMax, outMin, outMax) → number` | Map a value from one range to another. Composes `inverseLerp` and `lerp`.                                     |
| `fract`       | `(v) → number`                                   | Fractional part: `v - floor(v)`. Always returns [0, 1), even for negative inputs.                             |
| `mod`         | `(a, b) → number`                                | True modulo (not JS `%`). Result always has the same sign as the divisor. `mod(-1, 3)` returns `2`, not `-1`. |
| `degToRad`    | `(deg) → number`                                 | Convert degrees to radians.                                                                                   |
| `radToDeg`    | `(rad) → number`                                 | Convert radians to degrees.                                                                                   |
| `smoothstep`  | `(edge0, edge1, x) → number`                     | Hermite interpolation. Returns 0 when `x ≤ edge0`, 1 when `x ≥ edge1`, and smooth S-curve in between.         |

All parameters are `number`. All functions are pure.

## Vector Utilities (`vec.*`)

Import the `vec` namespace:

```ts
import { vec } from '@/lib/vec'
```

Functions are accessed as `vec.add(...)`, `vec.scale(...)`, etc. The namespace avoids collisions with scalar functions like `lerp`.

### Types

```ts
type Vec2 = [number, number]
type Vec3 = [number, number, number]
```

Dimension-generic functions accept both `Vec2` and `Vec3` and return the same type as the input.

### Arithmetic

| Function     | Signature      | Description                 |
| ------------ | -------------- | --------------------------- |
| `vec.add`    | `(a, b) → Vec` | Component-wise addition     |
| `vec.sub`    | `(a, b) → Vec` | Component-wise subtraction  |
| `vec.scale`  | `(a, s) → Vec` | Scalar multiply             |
| `vec.negate` | `(a) → Vec`    | Flip sign of all components |

### Measurement

| Function           | Signature         | Description                                                              |
| ------------------ | ----------------- | ------------------------------------------------------------------------ |
| `vec.dot`          | `(a, b) → number` | Dot product                                                              |
| `vec.len`          | `(a) → number`    | Length / magnitude                                                       |
| `vec.lenSq`        | `(a) → number`    | Squared length (avoids sqrt — faster for comparisons)                    |
| `vec.dist`         | `(a, b) → number` | Distance between two points                                              |
| `vec.distSq`       | `(a, b) → number` | Squared distance (avoids sqrt)                                           |
| `vec.angleBetween` | `(a, b) → number` | Angle between two vectors in radians. Returns 0 for zero-length vectors. |

### Interpolation & Normalization

| Function        | Signature         | Description                                             |
| --------------- | ----------------- | ------------------------------------------------------- |
| `vec.lerp`      | `(a, b, t) → Vec` | Linear interpolation between two vectors                |
| `vec.normalize` | `(a) → Vec`       | Unit vector. Returns zero vector for zero-length input. |

### 2D-Specific

| Function            | Signature          | Description             |
| ------------------- | ------------------ | ----------------------- |
| `vec.perpendicular` | `(a: Vec2) → Vec2` | 90° rotation: `[-y, x]` |

### 3D-Specific

| Function    | Signature                   | Description   |
| ----------- | --------------------------- | ------------- |
| `vec.cross` | `(a: Vec3, b: Vec3) → Vec3` | Cross product |

### Projection (3D → 2D)

| Function                  | Signature                       | Description                                                                   |
| ------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `vec.projectOrthographic` | `(p: Vec3, axis?) → Vec2`       | Drop one axis. Default `'z'` for top-down view. Options: `'x'`, `'y'`, `'z'`. |
| `vec.projectPerspective`  | `(p: Vec3, focalLength) → Vec2` | Perspective divide by z: `[x·f/z, y·f/z]`. Caller must ensure `z > 0`.        |

All vector functions return new arrays — no mutation.

## Usage Patterns

### Combining scalar and vector math

Scalar math and vector math have separate namespaces, so `lerp` and `vec.lerp` coexist:

```ts
import { lerp, clamp, mapRange } from '@/lib/math'
import { vec } from '@/lib/vec'

// Scalar lerp for a single value
const opacity = lerp(0, 1, t)

// Vector lerp for a point
const midpoint = vec.lerp([0, 0], [10, 5], 0.5) // → [5, 2.5]
```

### Point on a circle

```ts
import { degToRad } from '@/lib/math'
import { vec } from '@/lib/vec'
import type { Vec2 } from '@/lib/types'

function pointOnCircle(center: Vec2, radius: number, angleDeg: number): Vec2 {
  const rad = degToRad(angleDeg)
  return vec.add(center, [Math.cos(rad) * radius, Math.sin(rad) * radius])
}
```

### Rotating a 2D vector

```ts
import { degToRad } from '@/lib/math'
import type { Vec2 } from '@/lib/types'

function rotate(v: Vec2, angleDeg: number): Vec2 {
  const rad = degToRad(angleDeg)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos]
}
```

### Distance checks (avoiding sqrt)

Use `vec.distSq` and `vec.lenSq` when you only need to compare distances — avoids the `Math.sqrt` call:

```ts
import { vec } from '@/lib/vec'

// Check if two points are within 2cm of each other
const closeEnough = vec.distSq(a, b) < 2 * 2 // compare squared values

// Check if a vector is longer than 5
const isLong = vec.lenSq(v) > 5 * 5
```

### Normalizing direction + scaling

```ts
import { vec } from '@/lib/vec'

// Move point A toward point B by a fixed distance
const direction = vec.normalize(vec.sub(b, a))
const step = vec.scale(direction, 0.5) // 0.5cm step
const next = vec.add(a, step)
```

### 3D to 2D projection

```ts
import { vec } from '@/lib/vec'
import type { Vec3 } from '@/lib/types'

const points3D: Vec3[] = [
  [1, 2, 5],
  [3, 1, 8],
  [-2, 4, 6],
]

// Orthographic (drop Z axis)
const ortho = points3D.map((p) => vec.projectOrthographic(p))

// Perspective (focal length controls FOV)
const persp = points3D.map((p) => vec.projectPerspective(p, 10))
```
