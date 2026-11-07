import { isMyTeam, nextSeat, SEATS, type GameState, type Rules, type Seat } from './game'
import { hasNumber, NUMBERS, pips, type Tile, type TileId } from './tiles'

/**
 * Exact odds over every deal of the unseen tiles that fits what the table has shown:
 * the tiles left per seat, and the numbers each seat passed on. All such deals count
 * as equally likely, so this does not guess at why someone chose a play.
 */

/** Index 0, 1, 2 here means seat 1, 2, 3 (right, partner, left). */
type Allowed = (tileIndex: number, hiddenIndex: number) => boolean

export interface Hidden {
  tiles: Tile[]
  counts: number[]
  allowed: Allowed
}

export function hiddenFrom(state: GameState): Hidden {
  const { unseen: tiles, passedOn, handCounts } = state
  return {
    tiles,
    counts: [handCounts[1], handCounts[2], handCounts[3]],
    allowed: (t, s) => !passedOn[s + 1].has(tiles[t].hi) && !passedOn[s + 1].has(tiles[t].lo),
  }
}

/** Counts the ways to deal every tile, by how many have gone to the first two seats. */
export function countDeals({ tiles, counts }: Hidden, allowed: Allowed): number {
  const [c0, c1, c2] = counts
  if (tiles.length !== c0 + c1 + c2) return 0
  const width = c1 + 1
  let ways = new Float64Array((c0 + 1) * width)
  ways[0] = 1
  tiles.forEach((_, t) => {
    const next = new Float64Array(ways.length)
    for (let a = 0; a <= c0; a++) {
      for (let b = 0; b <= c1; b++) {
        const w = ways[a * width + b]
        if (w === 0) continue
        if (a < c0 && allowed(t, 0)) next[(a + 1) * width + b] += w
        if (b < c1 && allowed(t, 1)) next[a * width + b + 1] += w
        if (t - a - b < c2 && allowed(t, 2)) next[a * width + b] += w
      }
    }
    ways = next
  })
  return ways[c0 * width + c1]
}

/** Returns a function that draws one fitting deal at random, or null if no deal fits. */
export function dealSampler({ tiles, counts, allowed }: Hidden): ((rng: () => number) => Tile[][]) | null {
  const [c0, c1, c2] = counts
  const n = tiles.length
  if (n !== c0 + c1 + c2) return null
  const width = c1 + 1
  // ways[i] counts the deals of tiles i and up, by how many seats 0 and 1 still need.
  const ways: Float64Array[] = Array.from({ length: n + 1 }, () => new Float64Array((c0 + 1) * width))
  ways[n][0] = 1
  for (let t = n - 1; t >= 0; t--) {
    for (let a = 0; a <= c0; a++) {
      for (let b = 0; b <= c1; b++) {
        const rest = n - t - a - b
        if (rest < 0 || rest > c2) continue
        let w = 0
        if (a > 0 && allowed(t, 0)) w += ways[t + 1][(a - 1) * width + b]
        if (b > 0 && allowed(t, 1)) w += ways[t + 1][a * width + b - 1]
        if (rest > 0 && allowed(t, 2)) w += ways[t + 1][a * width + b]
        ways[t][a * width + b] = w
      }
    }
  }
  if (ways[0][c0 * width + c1] === 0) return null

  return (rng) => {
    const hands: Tile[][] = [[], [], []]
    let a = c0
    let b = c1
    tiles.forEach((tile, t) => {
      const rest = n - t - a - b
      const w0 = a > 0 && allowed(t, 0) ? ways[t + 1][(a - 1) * width + b] : 0
      const w1 = b > 0 && allowed(t, 1) ? ways[t + 1][a * width + b - 1] : 0
      const w2 = rest > 0 && allowed(t, 2) ? ways[t + 1][a * width + b] : 0
      const pick = rng() * (w0 + w1 + w2)
      if (pick < w0) {
        hands[0].push(tile)
        a--
      } else if (pick < w0 + w1) {
        hands[1].push(tile)
        b--
      } else {
        hands[2].push(tile)
      }
    })
    return hands
  }
}

export interface SeatRead {
  seat: Seat
  handCount: number
  /** Numbers still out there that this seat cannot hold. */
  missing: number[]
  /** Chance this seat holds each unseen tile. */
  odds: Map<TileId, number>
  certain: Tile[]
  possible: { tile: Tile; p: number }[]
  expectedPips: number
}

export interface Analysis {
  consistent: boolean
  reads: SeatRead[]
}

const CERTAIN = 1 - 1e-9

export function analyze(state: GameState, hidden = hiddenFrom(state)): Analysis {
  const total = countDeals(hidden, hidden.allowed)
  const reads = [0, 1, 2].map((s): SeatRead => {
    const odds = new Map<TileId, number>()
    hidden.tiles.forEach((tile, t) => {
      const forced = countDeals(hidden, (i, seat) => hidden.allowed(i, seat) && (i !== t || seat === s))
      odds.set(tile.id, total > 0 ? forced / total : 0)
    })
    const oddsOf = (tile: Tile) => odds.get(tile.id) ?? 0
    const held = hidden.tiles.filter((tile) => oddsOf(tile) > 0)
    return {
      seat: SEATS[s + 1],
      handCount: hidden.counts[s],
      missing: NUMBERS.filter(
        (n) => hidden.tiles.some((tile) => hasNumber(tile, n)) && !held.some((tile) => hasNumber(tile, n)),
      ),
      odds,
      certain: held.filter((tile) => oddsOf(tile) >= CERTAIN),
      possible: held
        .filter((tile) => oddsOf(tile) < CERTAIN)
        .map((tile) => ({ tile, p: oddsOf(tile) }))
        .sort((a, b) => b.p - a.p),
      expectedPips: hidden.tiles.reduce((sum, tile) => sum + oddsOf(tile) * pips(tile), 0),
    }
  })
  return { consistent: total > 0, reads }
}

/** Chance a seat holds none of the given numbers, so it has to pass on those ends. */
export function passChance(hidden: Hidden, seat: Seat, numbers: number[]): number {
  const total = countDeals(hidden, hidden.allowed)
  if (total === 0) return 0
  const s = seat - 1
  const blocked = countDeals(
    hidden,
    (t, i) => hidden.allowed(t, i) && !(i === s && numbers.some((n) => hasNumber(hidden.tiles[t], n))),
  )
  return blocked / total
}

export interface TranqueOdds {
  win: number
  tie: number
  lose: number
}

/** The chance your team takes a tranque, including any tie that goes your way. */
export function tranqueOdds(
  hidden: Hidden,
  myTiles: Tile[],
  blocker: Seat,
  starter: Seat,
  rules: Rules,
): TranqueOdds {
  const sign = (seat: Seat) => (isMyTeam(seat) ? 1 : -1)
  const weight = SEATS.map((seat) =>
    rules.tranqueMode === 'pairs' || seat === blocker || seat === nextSeat(blocker) ? sign(seat) : 0,
  )
  const [c0, c1, c2] = hidden.counts
  // Key packs the tiles dealt to seats 1 and 2, and the pip gap (your side minus theirs).
  const OFFSET = 256
  const pack = (a: number, b: number, diff: number) => (a * 8 + b) * 1024 + diff + OFFSET
  const base = weight[0] * myTiles.reduce((sum, tile) => sum + pips(tile), 0)
  let states = new Map<number, number>([[pack(0, 0, base), 1]])

  hidden.tiles.forEach((tile, t) => {
    const next = new Map<number, number>()
    const add = (key: number, w: number) => next.set(key, (next.get(key) ?? 0) + w)
    const value = pips(tile)
    for (const [key, w] of states) {
      const seats = Math.floor(key / 1024)
      const a = Math.floor(seats / 8)
      const b = seats % 8
      const diff = key - seats * 1024 - OFFSET
      if (a < c0 && hidden.allowed(t, 0)) add(pack(a + 1, b, diff + weight[1] * value), w)
      if (b < c1 && hidden.allowed(t, 1)) add(pack(a, b + 1, diff + weight[2] * value), w)
      if (t - a - b < c2 && hidden.allowed(t, 2)) add(pack(a, b, diff + weight[3] * value), w)
    }
    states = next
  })

  let lower = 0
  let tied = 0
  let higher = 0
  for (const [key, w] of states) {
    const seats = Math.floor(key / 1024)
    if (Math.floor(seats / 8) !== c0 || seats % 8 !== c1) continue
    const diff = key - seats * 1024 - OFFSET
    if (diff < 0) lower += w
    else if (diff === 0) tied += w
    else higher += w
  }
  const total = lower + tied + higher
  if (total === 0) return { win: 0, tie: 0, lose: 0 }
  const tieIsMine = isMyTeam(rules.tieGoesTo === 'blocker' ? blocker : starter)
  return {
    win: (lower + (tieIsMine ? tied : 0)) / total,
    tie: tied / total,
    lose: (higher + (tieIsMine ? 0 : tied)) / total,
  }
}
