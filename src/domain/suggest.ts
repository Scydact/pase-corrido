import { canPlay, isCapicua, placeOn, placements, type Ends, type GameState, type Seat, type Setup, type Side } from './game'
import type { Msg } from './messages'
import { dealSampler, passChance, tranqueOdds, type Analysis, type Hidden, type SeatRead } from './inference'
import { estimateCapicua, makeRng, type CapicuaOdds } from './simulate'
import { hasNumber, isDouble, NUMBERS, pips, type Tile } from './tiles'

export interface Suggestion {
  tile: Tile
  side: Side
  ends: Ends
  score: number
  reasons: Msg[]
  /** What this play does for your partner, with whether each note is good news. */
  partnerNotes: { msg: Msg; good: boolean }[]
  capicua: CapicuaOdds
}

const pct = (p: number) => Math.round(p * 100)
const NO_CAPICUA: CapicuaOdds = { mine: 0, partner: 0, rivals: 0 }

export interface PartnerSummary {
  lacks: number[]
  has: Tile[]
  likely: number[]
}

/** What the table shows about your partner's hand. */
export function partnerSummary(read: SeatRead, unseen: Tile[]): PartnerSummary {
  const expected = NUMBERS.map((n) =>
    unseen.filter((t) => hasNumber(t, n)).reduce((sum, t) => sum + (read.odds.get(t.id) ?? 0), 0),
  )
  const likely = NUMBERS.filter((n) => expected[n] >= 1.3)
    .sort((a, b) => expected[b] - expected[a])
    .slice(0, 2)
  return { lacks: read.missing, has: read.certain, likely }
}

/**
 * Ranks your legal plays. The odds in each reason are exact, except the capicúa
 * chances, which are simulated. The weights that combine them are a rule of thumb,
 * not a solved game.
 */
export function suggest(setup: Setup, state: GameState, hidden: Hidden, analysis: Analysis): Suggestion[] {
  const sample = dealSampler(hidden)
  const partnerRead = analysis.reads[1]
  const moves = state.myHand.flatMap((tile) =>
    placements(tile, state.ends).map((side): Suggestion => {
      const ends = placeOn(tile, side, state.ends)
      const rest = state.myHand.filter((t) => t.id !== tile.id)
      const reasons: Msg[] = []
      const partnerNotes: Suggestion['partnerNotes'] = []

      if (rest.length === 0) {
        const capicua = isCapicua(tile, state.ends)
        return {
          tile,
          side,
          ends,
          score: capicua ? 1100 : 1000,
          reasons: [{ key: capicua ? 'reason.dominoCapicua' : 'reason.domino' }],
          partnerNotes,
          capicua: { ...NO_CAPICUA, mine: capicua ? 1 : 0 },
        }
      }

      const anyoneCanPlay = [...rest, ...state.unseen].some((t) => canPlay(t, ends))
      if (!anyoneCanPlay) {
        const odds = tranqueOdds(hidden, rest, 0, setup.starter, setup.rules)
        reasons.push({ key: 'reason.locks', params: { pct: pct(odds.win) } })
        return { tile, side, ends, score: (odds.win * 2 - 1) * 60, reasons, partnerNotes, capicua: NO_CAPICUA }
      }

      const numbers = [...new Set(ends)]
      const right = passChance(hidden, 1, numbers)
      const partner = passChance(hidden, 2, numbers)
      const left = passChance(hidden, 3, numbers)
      const followUps = rest.filter((t) => canPlay(t, ends)).length

      // An opponent about to go out makes blocking them worth more.
      const urgency = (count: number) => (count <= 2 ? 65 : 40)
      let score = urgency(state.handCounts[1]) * right + (urgency(state.handCounts[3]) - 15) * left - 35 * partner
      score += pips(tile)
      if (isDouble(tile)) score += 6
      score += followUps > 0 ? followUps * 5 : -8

      const passNote = (seat: Seat, p: number, min: number) => {
        if (p === 1) reasons.push({ key: 'reason.mustPass', params: { seat } })
        else if (p >= min) reasons.push({ key: 'reason.passes', params: { seat, pct: pct(p) } })
      }
      // Nobody else holds a tile for these ends, and you do: all three pass and you play again.
      const othersLeft = state.unseen.filter((t) => canPlay(t, ends)).length
      if (othersLeft === 0) {
        score += 10
        reasons.push({ key: 'reason.paseCorrido' })
      } else {
        passNote(1, right, 0.15)
        passNote(3, left, 0.25)
        if (othersLeft <= 2 && followUps > 0) {
          score += 4
          reasons.push(
            othersLeft === 1
              ? { key: 'reason.paseCorridoNearOne' }
              : { key: 'reason.paseCorridoNear', params: { n: othersLeft } },
          )
        }
      }
      if (followUps === 0) reasons.push({ key: 'reason.noFollow' })
      else if (followUps === 1) reasons.push({ key: 'reason.followOne' })
      else reasons.push({ key: 'reason.followMany', params: { n: followUps } })
      if (isDouble(tile)) reasons.push({ key: 'reason.double' })
      if (pips(tile) >= 9) reasons.push({ key: 'reason.sheds', params: { n: pips(tile) } })

      // How many tiles the partner can expect to have for these ends.
      const partnerPlays = state.unseen
        .filter((t) => canPlay(t, ends))
        .reduce((sum, t) => sum + (partnerRead.odds.get(t.id) ?? 0), 0)
      score += Math.min(partnerPlays, 4) * 3

      if (analysis.consistent) {
        partnerNotes.push(
          partner === 1
            ? { msg: { key: 'partner.mustPass' }, good: false }
            : { msg: { key: 'partner.canPlay', params: { pct: pct(1 - partner) } }, good: partner < 0.25 },
        )
        numbers
          .filter((n) => partnerRead.missing.includes(n))
          .forEach((n) => partner < 1 && partnerNotes.push({ msg: { key: 'partner.lacks', params: { pip: n } }, good: false }))
      }

      // A number the partner just put out and that's still open is probably one they want.
      const theirs = analysis.consistent
        ? state.exposed[2].filter((n) => state.ends.includes(n) && !partnerRead.missing.includes(n))
        : []
      theirs.forEach((n) => {
        if (ends.includes(n)) {
          score += 5
          partnerNotes.push({ msg: { key: 'partner.keeps', params: { pip: n } }, good: true })
        } else {
          score -= 5
          partnerNotes.push({ msg: { key: 'partner.covers', params: { pip: n } }, good: false })
        }
      })

      const capicua = sample
        ? estimateCapicua(rest, ends, sample, makeRng(state.log.length * 7919 + 17))
        : NO_CAPICUA
      score += 60 * (capicua.mine + capicua.partner) - 40 * capicua.rivals
      if (capicua.mine >= 0.03) reasons.push({ key: 'reason.capicuaMine', params: { pct: pct(capicua.mine) } })
      if (capicua.rivals >= 0.08) reasons.push({ key: 'reason.capicuaRisk', params: { pct: pct(capicua.rivals) } })
      if (capicua.partner >= 0.03) {
        partnerNotes.push({ msg: { key: 'partner.capicua', params: { pct: pct(capicua.partner) } }, good: true })
      }

      return { tile, side, ends, score, reasons, partnerNotes, capicua }
    }),
  )
  return moves.sort((a, b) => b.score - a.score)
}

/** The play with the best capicúa chance for your team, if any is worth mentioning. */
export function bestCapicuaPlay(moves: Suggestion[]): Suggestion | null {
  const team = (m: Suggestion) => m.capicua.mine + m.capicua.partner
  const best = moves.reduce<Suggestion | null>((top, m) => (!top || team(m) > team(top) ? m : top), null)
  return best && team(best) >= 0.01 ? best : null
}
