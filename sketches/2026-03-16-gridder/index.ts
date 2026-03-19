import type { SketchModule, SketchContext, Polyline, Point } from '@/lib/types'
import { PAPER_SIZES } from '@/lib/paper'

const LEFT = 1
const RIGHT = 2
const TOP = 3
const BOTTOM = 4
type Edge = 1 | 2 | 3 | 4

const ALL_EDGES: Edge[] = [LEFT, RIGHT, TOP, BOTTOM]

interface Square {
  x: number
  y: number
  filled: boolean
  stroke: [Point, Point] | null
}

const sketch: SketchModule = {
  params: {
    seed: { value: 42, min: 0, max: 9999, step: 1 },
    paperSize: {
      value: 'letter',
      options: Object.keys(PAPER_SIZES),
    },
    margin: { value: 1.5, min: 0, max: 5, step: 0.1 },
    numColumns: { value: 100, min: 2, max: 300, step: 2 },
  },

  render(ctx: SketchContext, params: Record<string, unknown>): Polyline[] {
    const seed = params.seed as number
    const numColumns = params.numColumns as number

    const { width, height } = ctx
    const random = ctx.createRandom(seed)

    const squareSize = width / numColumns
    const numRows = Math.ceil(height / squareSize)
    const lastColumn = numColumns - 1
    const lastRow = numRows - 1
    const totalSquares = numColumns * numRows

    // Build grid
    const grid: Square[][] = []
    for (let x = 0; x < numColumns; x++) {
      grid.push([])
      for (let y = 0; y < numRows; y++) {
        grid[x].push({ x, y, filled: false, stroke: null })
      }
    }

    // --- Helper functions ---

    function positionFromIndex(ix: number, iy: number): Point {
      return [ix * squareSize, iy * squareSize]
    }

    function isValidIndex(ix: number, iy: number): boolean {
      return ix >= 0 && ix < numColumns && iy >= 0 && iy < numRows
    }

    function isEdgeSquare(sq: Square): boolean {
      return sq.x === 0 || sq.x === lastColumn || sq.y === 0 || sq.y === lastRow
    }

    // Returns which canvas edge a boundary square sits on (priority: left, right, top, bottom)
    function edgeOfSquare(sq: Square): Edge | undefined {
      if (sq.x === 0) return LEFT
      if (sq.x === lastColumn) return RIGHT
      if (sq.y === 0) return TOP
      if (sq.y === lastRow) return BOTTOM
      return undefined
    }

    function randomPointOnEdge(edge: Edge, sq: Square): Point {
      const posX = sq.x * squareSize
      const posY = sq.y * squareSize
      switch (edge) {
        case LEFT:
          return [posX, random.range(posY, posY + squareSize)]
        case RIGHT:
          return [posX + squareSize, random.range(posY, posY + squareSize)]
        case TOP:
          return [random.range(posX, posX + squareSize), posY]
        case BOTTOM:
          return [random.range(posX, posX + squareSize), posY + squareSize]
      }
    }

    function adjacentIndex(edge: Edge, sq: Square): [number, number] {
      switch (edge) {
        case LEFT: return [sq.x - 1, sq.y]
        case RIGHT: return [sq.x + 1, sq.y]
        case TOP: return [sq.x, sq.y - 1]
        case BOTTOM: return [sq.x, sq.y + 1]
      }
    }

    function hasEmptyAdjacent(edge: Edge, sq: Square): boolean {
      const [ix, iy] = adjacentIndex(edge, sq)
      return isValidIndex(ix, iy) && !grid[ix][iy].filled
    }

    // Determine which edge of a square a point sits on
    function edgeOfPoint(point: Point, sq: Square): Edge {
      const pos = positionFromIndex(sq.x, sq.y)
      if (point[0] === pos[0]) return LEFT
      if (point[0] === pos[0] + squareSize) return RIGHT
      if (point[1] === pos[1]) return TOP
      return BOTTOM
    }

    function randomEdgeSquare(): Square {
      // Fixed bug from original: was randomInt(1,4) which excluded BOTTOM
      const edge = random.rangeFloor(1, 5) as Edge
      switch (edge) {
        case LEFT:
          return grid[0][random.rangeFloor(0, numRows)]
        case RIGHT:
          return grid[lastColumn][random.rangeFloor(0, numRows)]
        case TOP:
          return grid[random.rangeFloor(0, numColumns)][0]
        case BOTTOM:
          return grid[random.rangeFloor(0, numColumns)][lastRow]
      }
    }

    function findEmptySquare(): Square | undefined {
      for (let x = 0; x < numColumns; x++) {
        for (let y = 0; y < numRows; y++) {
          if (!grid[x][y].filled) return grid[x][y]
        }
      }
      return undefined
    }

    // Fill a square with a line segment connecting two edges
    function fillSquare(
      current: Square,
      last: Square | undefined,
      continueLast: boolean,
    ): Polyline {
      current.filled = true

      // Determine entry point
      let pos1: Point
      if (continueLast && last?.stroke) {
        pos1 = last.stroke[1]
      } else if (isEdgeSquare(current)) {
        const edge = edgeOfSquare(current)!
        pos1 = randomPointOnEdge(edge, current)
      } else {
        pos1 = randomPointOnEdge(random.pick(ALL_EDGES), current)
      }

      const entryEdge = edgeOfPoint(pos1, current)

      // Choose exit edge, preferring one with an empty adjacent square
      let availableEdges = ALL_EDGES.filter(e => e !== entryEdge)
      let exitEdge = random.pick(availableEdges)

      if (!hasEmptyAdjacent(exitEdge, current)) {
        availableEdges = availableEdges.filter(e => e !== exitEdge)
        exitEdge = random.pick(availableEdges)

        if (!hasEmptyAdjacent(exitEdge, current)) {
          availableEdges = availableEdges.filter(e => e !== exitEdge)
          exitEdge = random.pick(availableEdges)
        }
      }

      const pos2 = randomPointOnEdge(exitEdge, current)
      current.stroke = [pos1, pos2]
      return [pos1, pos2]
    }

    // --- Main loop ---

    let currentSquare = randomEdgeSquare()
    let lastSquare: Square | undefined = undefined
    let continueLastStroke = false
    const polylines: Polyline[] = []

    for (let i = 0; i < totalSquares; i++) {
      const stroke = fillSquare(currentSquare, lastSquare, continueLastStroke)
      polylines.push(stroke)

      lastSquare = currentSquare

      // Find next square: prefer adjacent empty square via exit edge
      const lastEndpoint = lastSquare.stroke![1]
      const lastEdge = edgeOfPoint(lastEndpoint, lastSquare)
      const [nextX, nextY] = adjacentIndex(lastEdge, lastSquare)

      if (isValidIndex(nextX, nextY) && !grid[nextX][nextY].filled) {
        currentSquare = grid[nextX][nextY]
        continueLastStroke = true
      } else {
        const empty = findEmptySquare()
        if (!empty) break
        currentSquare = empty
        continueLastStroke = false
      }
    }

    return polylines
  },
}

export default sketch
