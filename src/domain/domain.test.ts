import { describe, expect, it } from 'vitest'
import { translate, translateParts } from '../i18n'
import { DEFAULT_RULES, forcedPasses, isCapicua, lockingPlays, numberCounts, placements, replay, type Move, type Setup } from './game'
import { analyze, countDeals, dealSampler, hiddenFrom, passChance, tranqueOdds, type Hidden } from './inference'
import { en as enText } from '../locales/en'
import { es as esText } from '../locales/es'
import {
  APP_PRESETS,
  appVars,
  contrast,
  DEFAULT_TILE_THEME,
  mix,
  presetIdOf,
  sanitize,
  TILE_PRESETS,
  tileVars,
  type AppTheme,
  type TilePreset,
} from '../theme'
import type { Msg } from './messages'
import { DEFAULT_SCORE_SETTINGS, handLines, totals, upgradeSavedLines } from './score'
import { estimateCapicua, makeRng } from './simulate'
import { bestCapicuaPlay, partnerSummary, suggest, type Suggestion } from './suggest'
import { ALL_TILES, parseTile } from './tiles'

const en = (m: Msg) => translate('en', m.key, m.params)
const notes = (m: Suggestion) => m.partnerNotes.map((n) => ({ text: en(n.msg), good: n.good }))

const suggestFor = (s: Setup, moves: Move[] = []) => {
  const state = replay(s, moves)
  const hidden = hiddenFrom(state)
  return suggest(s, state, hidden, analyze(state, hidden))
}

const setup = (over: Partial<Setup> = {}): Setup => ({
  hand: ['6:6', '6:3', '5:5', '4:2', '3:1', '1:0', '2:2'],
  startTile: '6:6',
  starter: 0,
  rules: DEFAULT_RULES,
  ...over,
})

const pass = (seat: 0 | 1 | 2 | 3): Move => ({ kind: 'pass', seat })
const play = (seat: 0 | 1 | 2 | 3, tile: string, side: 'left' | 'right' = 'right'): Move => ({
  kind: 'play',
  seat,
  tile,
  side,
})

/** You go out alone while everyone else passes; ends are 6|0 before the last tile. */
const CAPICUA_HAND = ['6:1', '2:1', '3:2', '4:3', '5:4', '5:0', '6:0']
const capicuaMoves = (): Move[] =>
  ['6:1', '2:1', '3:2', '4:3', '5:4', '5:0'].flatMap((tile) => [play(0, tile), pass(1), pass(2), pass(3)])

/** Every 0 gets played, ending with 6:0 on the left for ends 0|0. Starts with 0:0 from Left. */
const LOCK_SETUP = setup({
  hand: ['1:0', '4:3', '6:0', '6:6', '5:5', '4:4', '3:3'],
  startTile: '0:0',
  starter: 3,
})
const LOCK_MOVES: Move[] = [
  play(0, '1:0', 'left'),
  play(1, '2:1', 'left'),
  play(2, '2:0', 'left'),
  play(3, '3:0', 'left'),
  play(0, '4:3', 'left'),
  play(1, '4:0', 'left'),
  play(2, '5:0', 'left'),
  play(3, '6:5', 'left'),
]

describe('tiles', () => {
  it('has the 28 tiles of a double-six set', () => {
    expect(ALL_TILES).toHaveLength(28)
    expect(new Set(ALL_TILES.map((t) => t.id)).size).toBe(28)
  })
})

describe('replay', () => {
  it('starts after the opener, with their tile on the table', () => {
    const s = replay(setup(), [])
    expect(s.turn).toBe(1)
    expect(s.ends).toEqual([6, 6])
    expect(s.handCounts).toEqual([6, 7, 7, 7])
    expect(s.myHand).toHaveLength(6)
    expect(s.unseen).toHaveLength(21)
  })

  it('moves the ends and turn after a play', () => {
    const s = replay(setup(), [play(1, '6:5')])
    expect(s.ends).toEqual([6, 5])
    expect(s.turn).toBe(2)
    expect(s.chain.map((c) => c.tile)).toEqual(['6:6', '6:5'])
  })

  it('keeps the line connected on both sides', () => {
    const s = replay(setup(), [play(1, '6:5', 'left'), play(2, '6:4', 'right')])
    expect(s.ends).toEqual([5, 4])
    expect(s.chain).toEqual([
      { tile: '6:5', left: 5, right: 6 },
      { tile: '6:6', left: 6, right: 6 },
      { tile: '6:4', left: 6, right: 4 },
    ])
  })

  it('records the numbers a seat passed on and tags pase de salida', () => {
    const s = replay(setup(), [pass(1)])
    expect([...s.passedOn[1]]).toEqual([6])
    expect(s.log.at(-1)?.tags).toContain('paseSalida')
  })

  it('tags pase corrido when three pass and the player continues', () => {
    const s = replay(setup(), [pass(1), pass(2), pass(3), play(0, '6:3')])
    expect(s.log.at(-1)?.tags).toContain('paseCorrido')
  })

  it('warns when a seat plays a number it passed on', () => {
    const s = replay(setup(), [pass(1), play(2, '6:5'), play(3, '5:4'), play(0, '4:2'), play(1, '6:1', 'left')])
    expect(en(s.warnings[0])).toContain('Right')
    expect(s.passedOn[1].has(6)).toBe(false)
  })

  it('declares a domino with capicúa when the last tile fits two different ends', () => {
    const state = replay(setup({ hand: CAPICUA_HAND, starter: 3 }), [...capicuaMoves(), play(0, '6:0')])
    expect(state.outcome).toEqual({ kind: 'domino', winner: 0, capicua: true })
    expect(state.log.at(-1)?.tags).toContain('capicua')
  })

  it('does not call a last tile on one end a capicúa', () => {
    const hand = ['6:1', '2:1', '3:2', '4:3', '5:4', '5:0', '1:0']
    const moves = ['6:1', '2:1', '3:2', '4:3', '5:4', '5:0'].flatMap((tile) => [play(0, tile), pass(1), pass(2), pass(3)])
    const state = replay(setup({ hand, starter: 3 }), [...moves, play(0, '1:0')])
    expect(state.outcome).toEqual({ kind: 'domino', winner: 0, capicua: false })
  })

  it('does not call a double a capicúa', () => {
    expect(isCapicua(parseTile('5:3'), [5, 3])).toBe(true)
    expect(isCapicua(parseTile('3:3'), [3, 5])).toBe(false)
    expect(isCapicua(parseTile('5:5'), [5, 5])).toBe(false)
    expect(placements(parseTile('3:3'), [3, 5])).toEqual(['left'])
  })

  it('declares a tranque when no tile left can play on either end', () => {
    const before = replay(LOCK_SETUP, LOCK_MOVES)
    expect(before.ends).toEqual([6, 0])
    expect(before.outcome).toBeNull()
    const state = replay(LOCK_SETUP, [...LOCK_MOVES, play(0, '6:0', 'left')])
    expect(state.ends).toEqual([0, 0])
    expect(state.outcome).toEqual({ kind: 'tranque', blocker: 0 })
  })

  it('ends the hand after four passes in a row', () => {
    const state = replay(setup(), [pass(1), pass(2), pass(3), pass(0)])
    expect(state.outcome).toEqual({ kind: 'tranque', blocker: 0 })
  })
})

describe('lockingPlays', () => {
  it('finds the play that locks the table, on the right side only', () => {
    const plays = lockingPlays(replay(LOCK_SETUP, LOCK_MOVES))
    expect(plays.map((p) => [p.tile.id, p.side])).toEqual([['6:0', 'left']])
  })
})

describe('numberCounts', () => {
  it('splits every number into its 7 tiles', () => {
    const counts = numberCounts(replay(setup(), [play(1, '6:5')]))
    counts.forEach((c) => expect(c.played + c.mine + c.others).toBe(7))
    expect(counts[6]).toEqual({ number: 6, played: 2, mine: 1, others: 4 })
  })
})

/** Checks the DP against plain enumeration on small hands. */
function bruteCount(h: Hidden): number {
  const walk = (t: number, left: number[]): number => {
    if (t === h.tiles.length) return left.every((c) => c === 0) ? 1 : 0
    let sum = 0
    for (let s = 0; s < 3; s++) {
      if (left[s] > 0 && h.allowed(t, s)) {
        const next = left.slice()
        next[s]--
        sum += walk(t + 1, next)
      }
    }
    return sum
  }
  return walk(0, h.counts)
}

describe('inference', () => {
  const tiles = ['6:5', '6:4', '5:4', '3:2', '3:1', '2:1'].map(parseTile)
  const small: Hidden = {
    tiles,
    counts: [2, 2, 2],
    allowed: (t, s) => !(s === 0 && (tiles[t].hi === 6 || tiles[t].lo === 6)),
  }

  it('matches brute force', () => {
    expect(countDeals(small, small.allowed)).toBe(bruteCount(small))
    expect(countDeals(small, small.allowed)).toBeGreaterThan(0)
  })

  it('counts all 21-tile deals without constraints', () => {
    const h = hiddenFrom(replay(setup(), []))
    expect(countDeals(h, () => true)).toBe(399072960)
  })

  it('removes the numbers a seat passed on', () => {
    const read = analyze(replay(setup(), [pass(1)])).reads[0]
    expect(read.missing).toEqual([6])
    expect(read.odds.get('6:5')).toBe(0)
    expect(read.expectedPips).toBeGreaterThan(0)
  })

  it('sums each tile to 1 across the three seats', () => {
    const state = replay(setup(), [pass(1), play(2, '6:5')])
    const { reads } = analyze(state)
    state.unseen.forEach((t) => {
      const sum = reads.reduce((s, r) => s + (r.odds.get(t.id) ?? 0), 0)
      expect(sum).toBeCloseTo(1, 9)
    })
  })

  it('agrees with brute force on tile odds', () => {
    const h: Hidden = { ...small }
    const total = bruteCount(h)
    const forced = bruteCount({ ...h, allowed: (i, s) => h.allowed(i, s) && (i !== 3 || s === 0) })
    const viaDp = countDeals(h, (i, s) => h.allowed(i, s) && (i !== 3 || s === 0))
    expect(viaDp / total).toBeCloseTo(forced / total, 12)
  })

  it('deduces certain tiles by elimination', () => {
    // Right and Partner both pass on 6, so Left holds every remaining six.
    const left = analyze(replay(setup(), [pass(1), pass(2)])).reads[2]
    expect(left.certain.map((t) => t.id).sort()).toEqual(['6:0', '6:1', '6:2', '6:4', '6:5'])
  })

  it('reports inconsistent data when no deal fits', () => {
    // All three pass on 6 while five sixes are unseen.
    expect(analyze(replay(setup(), [pass(1), pass(2), pass(3)])).consistent).toBe(false)
  })

  it('gives a pass chance of 1 when the seat already lacks the number', () => {
    expect(passChance(hiddenFrom(replay(setup(), [pass(1)])), 1, [6])).toBe(1)
  })
})

describe('tranqueOdds', () => {
  const tiles = ['6:6', '0:0'].map(parseTile)
  const hidden: Hidden = { tiles, counts: [1, 1, 0], allowed: () => true }
  const mine = [parseTile('1:0')]

  it('compares combined pairs', () => {
    // You hold 1 pip. Partner holds 12 or 0, against Right's 0 or 12.
    const odds = tranqueOdds(hidden, mine, 0, 0, { tranqueMode: 'pairs', tieGoesTo: 'blocker' })
    expect(odds.win).toBeCloseTo(0.5)
    expect(odds.lose).toBeCloseTo(0.5)
  })

  it('compares only the blocker and the player on their right', () => {
    // Left blocks, so Left (holding nothing) faces you with 1 pip: your side always loses.
    const leftHolds: Hidden = { tiles, counts: [1, 1, 0], allowed: () => true }
    expect(tranqueOdds(leftHolds, mine, 3, 0, DEFAULT_RULES).win).toBe(0)
    // You block against Right, who holds 12 or 0.
    expect(tranqueOdds(hidden, mine, 0, 0, DEFAULT_RULES).win).toBeCloseTo(0.5)
  })

  it('applies the tie rule', () => {
    const even: Hidden = { tiles: [parseTile('1:0')], counts: [1, 0, 0], allowed: () => true }
    const blocker = tranqueOdds(even, mine, 0, 1, { tranqueMode: 'blockerVsNext', tieGoesTo: 'blocker' })
    expect(blocker.win).toBe(1)
    const starter = tranqueOdds(even, mine, 0, 1, { tranqueMode: 'blockerVsNext', tieGoesTo: 'starter' })
    expect(starter.win).toBe(0)
  })
})

describe('suggest', () => {
  it('offers only legal plays', () => {
    const s = setup({ hand: ['6:5', '5:4', '3:3', '2:2', '1:1', '0:0', '4:4'], startTile: '6:4', starter: 3 })
    expect(suggestFor(s).map((m) => m.tile.id).sort()).toEqual(['4:4', '5:4', '6:5'])
  })

  it('offers both placements of a tile that fits both ends', () => {
    const s = setup({ hand: ['6:3', '6:5', '0:0', '1:1', '2:2', '4:4', '5:5'], startTile: '3:3', starter: 3 })
    const moves = [play(0, '6:3', 'left'), play(1, '5:3', 'right'), pass(2), pass(3)]
    expect(replay(s, moves).ends).toEqual([6, 5])
    const placed = suggestFor(s, moves).filter((m) => m.tile.id === '6:5')
    expect(placed.map((m) => m.ends).sort()).toEqual([[5, 5], [6, 6]])
  })

  it('puts the winning tile first and names the capicúa', () => {
    const s = setup({ hand: CAPICUA_HAND, starter: 3 })
    const [best] = suggestFor(s, capicuaMoves())
    expect(best.tile.id).toBe('6:0')
    expect(en(best.reasons[0])).toContain('capicúa')
  })

  it('prefers the play that makes Right pass', () => {
    // Right passed on 2 and 1. Playing 6:1 leaves 1|1, while 6:5 leaves 5|1.
    const s = setup({ hand: ['2:1', '6:1', '6:5', '5:5', '4:4', '3:3', '0:0'], startTile: '2:1', starter: 0 })
    const moves = [pass(1), play(2, '1:1', 'right'), play(3, '6:2', 'left')]
    expect(replay(s, moves).ends).toEqual([6, 1])
    const [best] = suggestFor(s, moves)
    expect(best.tile.id).toBe('6:1')
    expect(best.reasons.map(en)).toContain('Right must pass')
  })

  it('explains a locking play with its tranque odds', () => {
    const lock = suggestFor(LOCK_SETUP, LOCK_MOVES).find((m) => m.tile.id === '6:0' && m.side === 'left')
    expect(en(lock!.reasons[0])).toContain('Locks the table')
  })

  /** Partner passed on 5 and 3; the ends are still 5|3 on your turn. */
  const partnerLacksFiveThree = () => ({
    s: setup({ hand: ['6:3', '5:3', '5:2', '0:0', '1:1', '4:4', '6:6'], startTile: '3:3', starter: 3 }),
    moves: [play(0, '6:3', 'left'), play(1, '6:5', 'left'), pass(2), play(3, '5:5', 'left')],
  })

  it('warns when a play leaves your partner nothing', () => {
    const { s, moves } = partnerLacksFiveThree()
    expect(replay(s, moves).ends).toEqual([5, 3])
    const onThree = suggestFor(s, moves).find((m) => m.tile.id === '5:3' && m.side === 'right')!
    expect(onThree.ends).toEqual([5, 5])
    expect(notes(onThree)[0]).toEqual({ text: 'Partner must pass', good: false })
  })

  it('ranks a play your partner can follow above one that is the same for you', () => {
    // 5:3 and 5:2 each leave you one follow-up and nearly the same pips, but 5:3 strands your partner.
    const { s, moves } = partnerLacksFiveThree()
    const ids = suggestFor(s, moves).map((m) => m.tile.id)
    expect(ids.indexOf('5:2')).toBeLessThan(ids.indexOf('5:3'))
  })

  it('names a number your partner lacks on the ends a play leaves', () => {
    const { s, moves } = partnerLacksFiveThree()
    const twoThree = suggestFor(s, moves).find((m) => m.tile.id === '5:2')!
    expect(twoThree.ends).toEqual([2, 3])
    expect(notes(twoThree).some((n) => n.text === 'Partner has no 3')).toBe(true)
  })

  it('credits keeping the number your partner put out, and flags covering it', () => {
    const s = setup({ hand: ['6:4', '1:0', '0:0', '2:2', '3:3', '5:5', '5:4'], startTile: '6:6', starter: 1 })
    const moves = [play(2, '6:1', 'right'), pass(3)]
    expect(replay(s, moves).ends).toEqual([6, 1])
    const plays = suggestFor(s, moves)
    const keeps = plays.find((m) => m.tile.id === '6:4')!
    expect(notes(keeps)).toContainEqual({ text: 'Keeps the 1 they put out', good: true })
    const covers = plays.find((m) => m.tile.id === '1:0')!
    expect(notes(covers)).toContainEqual({ text: 'Covers the 1 they put out', good: false })
  })

  it('gives no partner notes when the moves do not add up', () => {
    const s = setup({ hand: ['6:3', '5:3', '5:2', '0:0', '1:1', '4:4', '6:6'], startTile: '3:3', starter: 3 })
    const moves = [play(0, '6:3', 'left'), play(1, '6:5', 'left'), pass(2), pass(3)]
    suggestFor(s, moves).forEach((m) => expect(m.partnerNotes).toEqual([]))
  })
})

describe('pase corrido', () => {
  /** Ends 2|6 on your turn, with no 2, 5 or 6 left outside your hand. */
  const nearlyOut = () => {
    const s = setup({ hand: ['6:5', '5:1', '6:6', '5:5', '4:4', '3:3', '2:2'], startTile: '6:2', starter: 3 })
    const state = replay(s, [])
    const myHand = ['6:5', '5:1'].map(parseTile)
    const unseen = ['4:3', '4:1', '4:0', '3:1', '3:0', '1:1', '1:0', '0:0', '3:3'].map(parseTile)
    return { s, state: { ...state, myHand, unseen, handCounts: [2, 3, 3, 3], turn: 0 as const } }
  }

  it('names a play where all three must pass and you can continue', () => {
    const { s, state } = nearlyOut()
    const hidden = hiddenFrom(state)
    const move = suggest(s, state, hidden, analyze(state, hidden)).find((m) => m.tile.id === '6:5')!
    expect(move.ends).toEqual([5, 2])
    expect(move.reasons.map(en)[0]).toContain('Pase corrido')
  })

  it('hints when only a tile or two stand in the way', () => {
    const { s, state } = nearlyOut()
    const close = { ...state, unseen: state.unseen.map((t) => (t.id === '4:3' ? parseTile('5:3') : t)) }
    const hidden = hiddenFrom(close)
    const move = suggest(s, close, hidden, analyze(close, hidden)).find((m) => m.tile.id === '6:5')!
    expect(move.reasons.map(en)).toContain('Close to a pase corrido: 1 left outside your hand')
  })

  it('stays quiet when it is far off', () => {
    const s = setup()
    const state = replay(s, [pass(1), pass(2), pass(3)])
    const hidden = hiddenFrom(state)
    const all = suggest(s, state, hidden, analyze(state, hidden)).flatMap((m) => m.reasons.map(en))
    expect(all.filter((r) => r.includes('pase corrido') || r.includes('Pase corrido'))).toEqual([])
  })

  it('knows who must pass, only when nobody else holds a tile', () => {
    const { state } = nearlyOut()
    const afterPlay = { ...state, ends: [5, 2] as [number, number], turn: 1 as const }
    expect(forcedPasses(afterPlay)).toEqual([1, 2, 3])
    expect(forcedPasses({ ...afterPlay, turn: 3 })).toEqual([3])
    expect(forcedPasses({ ...afterPlay, ends: [4, 2] })).toEqual([])
    expect(forcedPasses({ ...afterPlay, turn: 0 })).toEqual([])
  })

  it('adds no points', () => {
    const s = setup()
    const state = replay(s, [pass(1), pass(2), pass(3), play(0, '6:3')])
    expect(state.log.at(-1)?.tags).toContain('paseCorrido')
    expect(totals(handLines(s, state, DEFAULT_SCORE_SETTINGS))).toEqual({ us: 25, them: 0 })
  })
})

describe('partnerSummary', () => {
  it('lists what your partner lacks', () => {
    const state = replay(setup(), [pass(1)])
    expect(partnerSummary(analyze(state).reads[0], state.unseen).lacks).toEqual([6])
  })

  it('lists what your partner holds for sure, and their likely numbers', () => {
    // Left, you and Right all pass on 6 over Partner's opening, so Partner holds the other sixes.
    const s = setup({ hand: ['5:5', '5:4', '4:3', '3:2', '2:1', '1:0', '0:0'], starter: 2 })
    const state = replay(s, [pass(3), pass(0), pass(1)])
    const summary = partnerSummary(analyze(state).reads[1], state.unseen)
    expect(summary.has.map((t) => t.id).sort()).toEqual(['6:0', '6:1', '6:2', '6:3', '6:4', '6:5'])
    expect(summary.likely[0]).toBe(6)
  })
})

describe('dealSampler', () => {
  it('returns null when no deal fits', () => {
    expect(dealSampler(hiddenFrom(replay(setup(), [pass(1), pass(2), pass(3)])))).toBeNull()
  })

  it('only draws deals that fit, with the same odds as the exact count', () => {
    const state = replay(setup(), [pass(1)])
    const hidden = hiddenFrom(state)
    const sample = dealSampler(hidden)!
    const rng = makeRng(1)
    const exact = analyze(state, hidden).reads[1].odds.get('6:5')!
    let partnerHits = 0
    const runs = 4000
    for (let i = 0; i < runs; i++) {
      const [right, partner, left] = sample(rng)
      expect([right.length, partner.length, left.length]).toEqual([7, 7, 7])
      expect(right.some((t) => t.hi === 6 || t.lo === 6)).toBe(false)
      if (partner.some((t) => t.id === '6:5')) partnerHits++
    }
    expect(partnerHits / runs).toBeCloseTo(exact, 1)
  })
})

describe('estimateCapicua', () => {
  const doubles = () => [[parseTile('0:0')], [parseTile('1:1')], [parseTile('2:2')]]

  it('reaches certainty when nobody can answer and your last tile fits both ends', () => {
    expect(estimateCapicua([parseTile('6:5')], [6, 5], doubles, makeRng(3), 50).mine).toBe(1)
  })

  it('gives no capicúa when your last tile is a double', () => {
    expect(estimateCapicua([parseTile('6:6')], [6, 6], doubles, makeRng(3), 50).mine).toBe(0)
  })

  it('credits a partner capicúa to the partner', () => {
    const sample = () => [[parseTile('0:0')], [parseTile('6:5')], [parseTile('2:2')]]
    const odds = estimateCapicua([parseTile('1:1')], [6, 5], sample, makeRng(3), 50)
    expect(odds.partner).toBe(1)
    expect(odds.mine).toBe(0)
  })
})

describe('bestCapicuaPlay', () => {
  const move = (id: string, mine: number, partner: number) =>
    ({ tile: parseTile(id), capicua: { mine, partner, rivals: 0 } }) as Suggestion

  it("picks the highest chance for your team, counting your partner's", () => {
    const best = bestCapicuaPlay([move('6:5', 0.05, 0), move('4:3', 0.02, 0.06), move('2:1', 0, 0)])
    expect(best?.tile.id).toBe('4:3')
  })

  it('stays quiet when no play has a real chance', () => {
    expect(bestCapicuaPlay([move('6:5', 0, 0.005)])).toBeNull()
  })
})

describe('score', () => {
  it('gives the winning team all the pips left, plus capicúa', () => {
    const s = setup({ hand: CAPICUA_HAND, starter: 3 })
    const state = replay(s, [...capicuaMoves(), play(0, '6:0')])
    const lines = handLines(s, state, DEFAULT_SCORE_SETTINGS)
    const pipsLeft = state.unseen.reduce((sum, t) => sum + t.hi + t.lo, 0)
    // Pips in the 28-tile set total 168, and this hand played 6:6 plus your seven tiles.
    expect(pipsLeft).toBe(168 - 12 - 7 - 3 - 5 - 7 - 9 - 5 - 6)
    expect(totals(lines)).toEqual({ us: pipsLeft + 25, them: 0 })
  })

  it("counts a pase de salida for the opener's team right away", () => {
    const opener = replay(setup({ starter: 0 }), [pass(1)])
    expect(totals(handLines(setup({ starter: 0 }), opener, DEFAULT_SCORE_SETTINGS))).toEqual({ us: 25, them: 0 })
    const rival = setup({ hand: ['5:5', '6:3', '4:2', '3:1', '1:0', '2:2', '0:0'], starter: 1 })
    const passed = replay(rival, [pass(2)])
    expect(totals(handLines(rival, passed, DEFAULT_SCORE_SETTINGS))).toEqual({ us: 0, them: 25 })
  })

  it('uses the configured bonus values', () => {
    const s = setup({ hand: CAPICUA_HAND, starter: 3 })
    const state = replay(s, [...capicuaMoves(), play(0, '6:0')])
    const lines = handLines(s, state, { capicua: 30, salida: 10 })
    expect(lines.find((l) => l.kind === 'capicua')?.points).toBe(30)
  })

  it('scores a tranque only once you say who won', () => {
    const state = replay(LOCK_SETUP, [...LOCK_MOVES, play(0, '6:0', 'left')])
    expect(handLines(LOCK_SETUP, state, DEFAULT_SCORE_SETTINGS)).toEqual([])
    const lines = handLines(LOCK_SETUP, state, DEFAULT_SCORE_SETTINGS, 'them')
    expect(totals(lines).us).toBe(0)
    expect(totals(lines).them).toBeGreaterThan(0)
  })
})

describe('saved scores from before translation', () => {
  it('keeps old lines and works out their kind', () => {
    const old = [
      { team: 'us' as const, label: 'Pase de salida', points: 25 },
      { team: 'us' as const, label: 'Pips left in all hands', points: 114 },
      { team: 'them' as const, label: 'Capicúa', points: 30 },
    ] as Parameters<typeof upgradeSavedLines>[0]
    expect(upgradeSavedLines(old)).toEqual([
      { team: 'us', kind: 'salida', points: 25 },
      { team: 'us', kind: 'pips', points: 114 },
      { team: 'them', kind: 'capicua', points: 30 },
    ])
  })
})

describe('translate', () => {
  it('fills in values and seat names in each language', () => {
    expect(translate('en', 'reason.mustPass', { seat: 1 })).toBe('Right must pass')
    expect(translate('es', 'reason.mustPass', { seat: 1 })).toBe('Derecha tiene que pasar')
    expect(translate('es', 'quick.line', { table: 2, mine: 1, others: 4 })).toBe(
      '2 en la mesa, 1 en tu mano, 4 en otras manos',
    )
  })

  it('uses the "you" wording for your own seat', () => {
    expect(translate('es', 'log.played', { seat: 0, tile: '6:3' })).toBe('Jugaste 6:3')
    expect(translate('es', 'log.played', { seat: 3, tile: '6:3' })).toBe('Izquierda jugó 6:3')
  })

  it('splits a translation around drawn placeholders, keeping its word order', () => {
    expect(translateParts('es', 'counts.lock', ['tile', 'ends'], { owner: 'tuya' })).toEqual([
      { slot: 'tile' },
      { text: ' (tuya) la tranca en ' },
      { slot: 'ends' },
    ])
    expect(translateParts('en', 'counts.canPlay', ['ends'], { total: 3, mine: 1, others: 2 })).toEqual([
      { text: 'Can still play on ' },
      { slot: 'ends' },
      { text: ': 3 (1 on you, 2 on other hands).' },
    ])
  })

  it('has every placeholder match between languages', () => {
    const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join()
    for (const key of Object.keys(enText) as (keyof typeof enText)[]) {
      expect(holes(esText[key]), key).toBe(holes(enText[key]))
    }
  })
})

describe('themes', () => {
  it('measures contrast and mixes colors', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#123456', '#123456')).toBe(1)
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('keeps every app preset readable', () => {
    for (const [id, theme] of Object.entries(APP_PRESETS)) {
      const vars = appVars(theme)
      expect(contrast(vars['--text'], vars['--bg']), id).toBeGreaterThanOrEqual(4.5)
      expect(contrast(vars['--text'], vars['--panel']), id).toBeGreaterThanOrEqual(4.5)
      expect(contrast(vars['--muted'], vars['--panel']), id).toBeGreaterThanOrEqual(3)
      expect(contrast(vars['--accent-text'], vars['--accent']), id).toBeGreaterThanOrEqual(4.5)
      expect(contrast(vars['--good'], vars['--panel-2']), id).toBeGreaterThanOrEqual(3)
      expect(contrast(vars['--warn'], vars['--panel-2']), id).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps colored dots visible on every tile preset', () => {
    for (const [id, preset] of Object.entries(TILE_PRESETS)) {
      for (const coloredPips of [false, true]) {
        const vars = tileVars({ ...DEFAULT_TILE_THEME, ...preset, coloredPips })
        for (let n = 1; n <= 6; n++) {
          expect(contrast(vars[`--pip-${n}`], preset.tile), `${id} ${n}`).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })

  it('gives each number its own color only when colored dots are on', () => {
    const numbers = [1, 2, 3, 4, 5, 6]
    const plain = tileVars(DEFAULT_TILE_THEME)
    expect(new Set(numbers.map((n) => plain[`--pip-${n}`])).size).toBe(1)
    for (const [id, preset] of Object.entries(TILE_PRESETS)) {
      const colored = tileVars({ ...DEFAULT_TILE_THEME, ...preset, coloredPips: true })
      expect(new Set(numbers.map((n) => colored[`--pip-${n}`])).size, id).toBeGreaterThanOrEqual(5)
    }
  })

  it('uses your color for a number, and the automatic one for the rest', () => {
    const vars = tileVars({ ...DEFAULT_TILE_THEME, coloredPips: true, color1: '#123456', color3: '#ff00ff' })
    const auto = tileVars({ ...DEFAULT_TILE_THEME, coloredPips: true })
    expect(vars['--pip-1']).toBe('#123456')
    expect(vars['--pip-3']).toBe('#ff00ff')
    expect(vars['--pip-2']).toBe(auto['--pip-2'])
  })

  it('ignores your colors while colored dots are off', () => {
    const vars = tileVars({ ...DEFAULT_TILE_THEME, color2: '#123456' })
    expect(vars['--pip-2']).toBe(DEFAULT_TILE_THEME.pip)
  })

  it('keeps chosen dot colors when saved, and rejects bad ones', () => {
    expect(sanitize({ color2: '#123456', color3: 'blue', color4: '' }, DEFAULT_TILE_THEME)).toEqual({
      ...DEFAULT_TILE_THEME,
      color2: '#123456',
    })
  })

  it('recognizes a preset whatever the options, and calls a color edit custom', () => {
    const presets = TILE_PRESETS as Record<string, TilePreset>
    const theme = { ...DEFAULT_TILE_THEME, ...TILE_PRESETS.inverse, speck: true, spinner: true }
    expect(presetIdOf(theme, presets)).toBe('inverse')
    expect(presetIdOf({ ...theme, pip: '#ff0000' }, presets)).toBeNull()
  })

  it('ignores bad saved values', () => {
    const fallback: AppTheme = APP_PRESETS.table
    expect(sanitize({ bg: 'red', fg: '#000000', extra: 1 }, fallback)).toEqual({ ...fallback, fg: '#000000' })
    expect(sanitize(null, fallback)).toEqual(fallback)
    expect(sanitize({ spinner: 'yes', speck: true }, DEFAULT_TILE_THEME)).toEqual({ ...DEFAULT_TILE_THEME, speck: true })
  })
})
