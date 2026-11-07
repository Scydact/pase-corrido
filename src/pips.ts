type Speck = [x: number, y: number, r: number]

/** Scatters specks over a 50x100 tile. The seed is fixed so a tile always looks the same. */
function scatter(count: number, seed: number, maxRadius: number): Speck[] {
  let state = seed
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  return Array.from({ length: count }, (): Speck => {
    const size = next()
    return [3 + next() * 44, 3 + next() * 94, 0.3 + size * size * maxRadius]
  })
}

export const DARK_SPECKS = scatter(80, 7, 0.75)
export const LIGHT_SPECKS = scatter(30, 23, 0.7)

/** Pip positions on a 3x3 grid, by number. */
export const PIP_PATTERNS: [number, number][][] = [
  [],
  [[1, 1]],
  [[0, 0], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 0], [2, 0], [0, 2], [2, 2]],
  [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
]
