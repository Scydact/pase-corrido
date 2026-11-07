export type TileId = string

export interface Tile {
  id: TileId
  hi: number
  lo: number
}

export const NUMBERS = [0, 1, 2, 3, 4, 5, 6]

export function tileId(a: number, b: number): TileId {
  return a >= b ? `${a}:${b}` : `${b}:${a}`
}

export function parseTile(id: TileId): Tile {
  const [a, b] = id.split(':').map(Number)
  return { id: tileId(a, b), hi: Math.max(a, b), lo: Math.min(a, b) }
}

/** The full double-six set, highest first. */
export const ALL_TILES: Tile[] = NUMBERS.slice()
  .reverse()
  .flatMap((hi) =>
    NUMBERS.slice(0, hi + 1)
      .reverse()
      .map((lo) => parseTile(tileId(hi, lo))),
  )

export const hasNumber = (t: Tile, n: number) => t.hi === n || t.lo === n
export const isDouble = (t: Tile) => t.hi === t.lo
export const pips = (t: Tile) => t.hi + t.lo
