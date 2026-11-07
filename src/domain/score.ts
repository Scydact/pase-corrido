import { isMyTeam, totalPips, type GameState, type Seat, type Setup } from './game'

export type Team = 'us' | 'them'
export const teamOf = (seat: Seat): Team => (isMyTeam(seat) ? 'us' : 'them')

export interface ScoreSettings {
  capicua: number
  salida: number
}

export const DEFAULT_SCORE_SETTINGS: ScoreSettings = { capicua: 25, salida: 25 }

export type ScoreKind = 'salida' | 'pips' | 'capicua'

export interface ScoreLine {
  team: Team
  kind: ScoreKind
  points: number
}

const OLD_LABELS: Record<string, ScoreKind> = {
  'Pase de salida': 'salida',
  'Pips left in all hands': 'pips',
  'Capicúa': 'capicua',
}

/** Scores saved before the app was translated kept an English label instead of a kind. */
export function upgradeSavedLines(lines: (ScoreLine & { label?: string })[]): ScoreLine[] {
  return lines.map(({ team, kind, label, points }) => ({ team, points, kind: kind ?? OLD_LABELS[label ?? ''] ?? 'pips' }))
}

/**
 * What a hand has scored so far. A pase de salida counts for the opener's team as soon
 * as it happens. The winner of a hand takes the pips left in all hands, which is exact
 * even though you can't see the tiles, since only their total matters.
 */
export function handLines(
  setup: Setup,
  state: GameState,
  settings: ScoreSettings,
  tranqueWinner?: Team,
): ScoreLine[] {
  const lines: ScoreLine[] = []
  if (state.log.some((e) => e.tags.includes('paseSalida'))) {
    lines.push({ team: teamOf(setup.starter), kind: 'salida', points: settings.salida })
  }
  const pipsLeft = totalPips(state.myHand) + totalPips(state.unseen)
  const pipsLine = (team: Team): ScoreLine => ({ team, kind: 'pips', points: pipsLeft })
  if (state.outcome?.kind === 'domino') {
    const team = teamOf(state.outcome.winner)
    lines.push(pipsLine(team))
    if (state.outcome.capicua) lines.push({ team, kind: 'capicua', points: settings.capicua })
  } else if (state.outcome?.kind === 'tranque' && tranqueWinner) {
    lines.push(pipsLine(tranqueWinner))
  }
  return lines
}

export function totals(lines: ScoreLine[]): Record<Team, number> {
  const sum = (team: Team) => lines.filter((l) => l.team === team).reduce((s, l) => s + l.points, 0)
  return { us: sum('us'), them: sum('them') }
}
