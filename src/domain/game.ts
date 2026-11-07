import type { Msg } from './messages'
import { ALL_TILES, hasNumber, isDouble, parseTile, pips, type Tile, type TileId } from './tiles'

/** Turn order runs to the right: you, right, partner (frente), left. */
export type Seat = 0 | 1 | 2 | 3
export const SEATS: Seat[] = [0, 1, 2, 3]

export const nextSeat = (s: Seat) => ((s + 1) % 4) as Seat
export const isMyTeam = (s: Seat) => s % 2 === 0

export type Side = 'left' | 'right'
export type Ends = [left: number, right: number]

export interface Rules {
  /** Who compares hands at a tranque. */
  tranqueMode: 'blockerVsNext' | 'pairs'
  tieGoesTo: 'blocker' | 'starter'
}

export const DEFAULT_RULES: Rules = { tranqueMode: 'blockerVsNext', tieGoesTo: 'blocker' }

export interface Setup {
  hand: TileId[]
  startTile: TileId
  starter: Seat
  rules: Rules
}

export type Move = { kind: 'play'; seat: Seat; tile: TileId; side: Side } | { kind: 'pass'; seat: Seat }

export interface ChainTile {
  tile: TileId
  left: number
  right: number
}

export type LogTag = 'salida' | 'paseSalida' | 'paseCorrido' | 'capicua'

export interface LogEntry {
  seat: Seat
  msg: Msg
  tags: LogTag[]
}

export type Outcome =
  | { kind: 'domino'; winner: Seat; capicua: boolean }
  | { kind: 'tranque'; blocker: Seat }

export interface GameState {
  chain: ChainTile[]
  ends: Ends
  turn: Seat
  myHand: Tile[]
  /** Tiles still in the other three hands, unknown to you. */
  unseen: Tile[]
  /** Tiles left per seat, including you. */
  handCounts: number[]
  /** Numbers each seat has shown it lacks by passing. */
  passedOn: Set<number>[]
  /** The numbers each seat put out with their latest play. */
  exposed: number[][]
  played: Set<TileId>
  log: LogEntry[]
  warnings: Msg[]
  outcome: Outcome | null
}

/** The ways a tile can attach. Equal ends count once, since both give the same table. */
export function placements(tile: Tile, [l, r]: Ends): Side[] {
  const sides: Side[] = []
  if (hasNumber(tile, l)) sides.push('left')
  if (l !== r && hasNumber(tile, r)) sides.push('right')
  return sides
}

export function placeOn(tile: Tile, side: Side, [l, r]: Ends): Ends {
  const end = side === 'left' ? l : r
  const outward = tile.hi === end ? tile.lo : tile.hi
  return side === 'left' ? [outward, r] : [l, outward]
}

export const isCapicua = (tile: Tile, [l, r]: Ends) =>
  !isDouble(tile) && l !== r && hasNumber(tile, l) && hasNumber(tile, r)

export const canPlay = (tile: Tile, [l, r]: Ends) => hasNumber(tile, l) || hasNumber(tile, r)

export function replay(setup: Setup, moves: Move[]): GameState {
  const start = parseTile(setup.startTile)
  const chain: ChainTile[] = [{ tile: start.id, left: start.hi, right: start.lo }]
  let ends: Ends = [start.hi, start.lo]
  const played = new Set<TileId>([start.id])
  const handCounts = [7, 7, 7, 7]
  handCounts[setup.starter]--
  const passedOn = SEATS.map(() => new Set<number>())
  const exposed: number[][] = SEATS.map(() => [])
  exposed[setup.starter] = [...new Set([start.hi, start.lo])]
  const log: LogEntry[] = [
    {
      seat: setup.starter,
      msg: { key: 'log.opened', params: { seat: setup.starter, tile: start.id } },
      tags: start.id === '6:6' ? ['salida'] : [],
    },
  ]
  const warnings: Msg[] = []
  let turn = nextSeat(setup.starter)
  let lastPlayer = setup.starter
  let passesInARow = 0
  let outcome: Outcome | null = null

  moves.forEach((move, index) => {
    if (move.kind === 'pass') {
      passedOn[move.seat].add(ends[0]).add(ends[1])
      passesInARow++
      const tags: LogTag[] = index === 0 ? ['paseSalida'] : []
      const msg: Msg =
        ends[0] === ends[1]
          ? { key: 'log.passedOne', params: { seat: move.seat, pip: ends[0] } }
          : { key: 'log.passed', params: { seat: move.seat, a: ends[0], b: ends[1] } }
      log.push({ seat: move.seat, msg, tags })
    } else {
      const tile = parseTile(move.tile)
      const tags: LogTag[] = []
      const reneged = [tile.hi, tile.lo].filter((n) => passedOn[move.seat].has(n))
      if (reneged.length > 0) {
        warnings.push({ key: 'warn.reneged', params: { seat: move.seat, tile: tile.id, nums: reneged } })
        reneged.forEach((n) => passedOn[move.seat].delete(n))
      }
      if (passesInARow === 3) tags.push('paseCorrido')
      const goesOut = handCounts[move.seat] === 1
      const capicua = goesOut && isCapicua(tile, ends)
      if (capicua) tags.push('capicua')

      const [left, right] = placeOn(tile, move.side, ends)
      if (move.side === 'left') chain.unshift({ tile: tile.id, left, right: ends[0] })
      else chain.push({ tile: tile.id, left: ends[1], right })
      exposed[move.seat] = [move.side === 'left' ? left : right]
      ends = [left, right]
      played.add(tile.id)
      handCounts[move.seat]--
      lastPlayer = move.seat
      passesInARow = 0
      log.push({ seat: move.seat, msg: { key: 'log.played', params: { seat: move.seat, tile: tile.id } }, tags })
      if (goesOut) outcome = { kind: 'domino', winner: move.seat, capicua }
    }
    turn = nextSeat(move.seat)
  })

  const myHand = setup.hand.filter((id) => !played.has(id)).map(parseTile)
  const unseen = ALL_TILES.filter((t) => !played.has(t.id) && !setup.hand.includes(t.id))
  const anyPlayable = [...myHand, ...unseen].some((t) => canPlay(t, ends))
  if (!outcome && (!anyPlayable || passesInARow >= 4)) outcome = { kind: 'tranque', blocker: lastPlayer }

  return { chain, ends, turn, myHand, unseen, handCounts, passedOn, exposed, played, log, warnings, outcome }
}

/** Every play by anyone that would lock the table right away. */
export function lockingPlays(state: GameState) {
  const remaining = [...state.myHand, ...state.unseen]
  return remaining.flatMap((tile) =>
    placements(tile, state.ends)
      .map((side) => ({ tile, side, ends: placeOn(tile, side, state.ends) }))
      .filter(({ tile: t, ends }) => !remaining.some((o) => o.id !== t.id && canPlay(o, ends))),
  )
}

/**
 * The seats that must pass before your next turn, when nobody else holds a tile for the
 * ends. Every unseen tile is in one of those hands, so this is certain, not a guess.
 */
export function forcedPasses(state: GameState): Seat[] {
  if (state.outcome || state.turn === 0 || state.unseen.some((t) => canPlay(t, state.ends))) return []
  const seats: Seat[] = []
  for (let seat: Seat = state.turn; seat !== 0; seat = nextSeat(seat)) seats.push(seat)
  return seats
}

export interface NumberCount {
  number: number
  played: number
  mine: number
  others: number
}

/** How each number's 7 tiles are split between the table, you and the other hands. */
export function numberCounts(state: GameState): NumberCount[] {
  return [0, 1, 2, 3, 4, 5, 6].map((number) => {
    const count = (tiles: Tile[]) => tiles.filter((t) => hasNumber(t, number)).length
    const mine = count(state.myHand)
    const others = count(state.unseen)
    return { number, played: 7 - mine - others, mine, others }
  })
}

export const totalPips = (tiles: Tile[]) => tiles.reduce((sum, t) => sum + pips(t), 0)
