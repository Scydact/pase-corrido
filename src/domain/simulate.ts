import { isCapicua, nextSeat, placeOn, placements, type Ends, type Seat } from './game'
import { isDouble, pips, type Tile } from './tiles'

export function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface CapicuaOdds {
  mine: number
  partner: number
  rivals: number
}

type Rng = () => number

/** A plausible player: sheds pips, and with two tiles left, steers toward a capicúa. */
function choosePlay(hand: Tile[], ends: Ends, rng: Rng) {
  let best: { tile: Tile; ends: Ends } | null = null
  let bestScore = -Infinity
  for (const tile of hand) {
    for (const side of placements(tile, ends)) {
      const after = placeOn(tile, side, ends)
      let score = pips(tile) * 0.15 + rng() * 1.5
      if (hand.length === 1) score += 100
      if (hand.length === 2) {
        const last = hand[0] === tile ? hand[1] : hand[0]
        if (!isDouble(last)) {
          if (isCapicua(last, after)) score += 3
          else if (after.includes(last.hi) || after.includes(last.lo)) score += 1
        }
      }
      if (score > bestScore) {
        bestScore = score
        best = { tile, ends: after }
      }
    }
  }
  return best
}

/** Plays a hand out and returns the seat that went out with a capicúa, if any. */
function playOut(hands: Tile[][], startEnds: Ends, startSeat: Seat, rng: Rng): Seat | null {
  let ends = startEnds
  let seat = startSeat
  let passes = 0
  while (passes < 4) {
    const hand = hands[seat]
    const play = choosePlay(hand, ends, rng)
    if (!play) {
      passes++
    } else {
      passes = 0
      if (hand.length === 1) return isCapicua(play.tile, ends) ? seat : null
      hands[seat] = hand.filter((t) => t !== play.tile)
      ends = play.ends
    }
    seat = nextSeat(seat)
  }
  return null
}

/**
 * Estimates each side's chance of a capicúa after your play, by playing out random
 * deals. Nobody in these playouts blocks a capicúa on purpose, so treat it as a guide.
 */
export function estimateCapicua(
  myRest: Tile[],
  ends: Ends,
  sample: (rng: Rng) => Tile[][],
  rng: Rng,
  runs = 400,
): CapicuaOdds {
  const hits = [0, 0, 0, 0]
  for (let i = 0; i < runs; i++) {
    const [right, partner, left] = sample(rng)
    const seat = playOut([myRest, right, partner, left], ends, 1, rng)
    if (seat !== null) hits[seat]++
  }
  return { mine: hits[0] / runs, partner: hits[2] / runs, rivals: (hits[1] + hits[3]) / runs }
}
