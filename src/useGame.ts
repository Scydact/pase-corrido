import { computed, ref, watch } from 'vue'
import { DEFAULT_RULES, replay, type Move, type Rules, type Seat, type Setup, type Side } from './domain/game'
import { analyze, hiddenFrom, tranqueOdds } from './domain/inference'
import {
  DEFAULT_SCORE_SETTINGS,
  handLines,
  totals,
  upgradeSavedLines,
  type ScoreLine,
  type ScoreSettings,
  type Team,
} from './domain/score'
import { partnerSummary, suggest } from './domain/suggest'
import type { TileId } from './domain/tiles'

const STORAGE_KEY = 'domino-helper:v1'

interface Saved {
  setup: Setup | null
  moves: Move[]
  /** Finished hands, each with its score lines. */
  hands?: ScoreLine[][]
  settings?: ScoreSettings
  /** Tranque rules for the next hand. Each hand keeps its own copy in its setup. */
  rules?: Rules
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

function save(saved: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // The hand still works without storage; it just won't survive a reload.
  }
}

const saved = load()
const setup = ref<Setup | null>(saved?.setup ?? null)
const moves = ref<Move[]>(saved?.moves ?? [])
const hands = ref<ScoreLine[][]>((saved?.hands ?? []).map(upgradeSavedLines))
const settings = ref<ScoreSettings>(saved?.settings ?? { ...DEFAULT_SCORE_SETTINGS })
const rules = ref<Rules>(saved?.rules ?? { ...DEFAULT_RULES })

watch(
  [setup, moves, hands, settings, rules],
  () =>
    save({
      setup: setup.value,
      moves: moves.value,
      hands: hands.value,
      settings: settings.value,
      rules: rules.value,
    }),
  { deep: true },
)

const state = computed(() => (setup.value ? replay(setup.value, moves.value) : null))
const hidden = computed(() => (state.value ? hiddenFrom(state.value) : null))
const analysis = computed(() => (state.value && hidden.value ? analyze(state.value, hidden.value) : null))

const suggestions = computed(() => {
  const [s, g, h, a] = [setup.value, state.value, hidden.value, analysis.value]
  if (!s || !g || !h || !a || g.outcome || g.turn !== 0) return []
  return suggest(s, g, h, a)
})

const partner = computed(() => {
  const [g, a] = [state.value, analysis.value]
  return g && a?.consistent ? partnerSummary(a.reads[1], g.unseen) : null
})

const finalTranqueOdds = computed(() => {
  const [s, g, h] = [setup.value, state.value, hidden.value]
  if (!s || !g || !h || g.outcome?.kind !== 'tranque') return null
  return tranqueOdds(h, g.myHand, g.outcome.blocker, s.starter, s.rules)
})

/** What the hand in progress has scored so far. */
const currentLines = computed(() =>
  setup.value && state.value ? handLines(setup.value, state.value, settings.value) : [],
)

const score = computed(() => totals([...hands.value.flat(), ...currentLines.value]))

function clearHand() {
  setup.value = null
  moves.value = []
}

export function useGame() {
  return {
    setup,
    moves,
    state,
    hidden,
    analysis,
    suggestions,
    partner,
    finalTranqueOdds,
    hands,
    settings,
    rules,
    currentLines,
    score,
    start(next: Setup) {
      setup.value = next
      moves.value = []
    },
    play(seat: Seat, tile: TileId, side: Side) {
      moves.value.push({ kind: 'play', seat, tile, side })
    },
    pass(seat: Seat) {
      moves.value.push({ kind: 'pass', seat })
    },
    passAll(seats: Seat[]) {
      seats.forEach((seat) => moves.value.push({ kind: 'pass', seat }))
    },
    undo() {
      moves.value.pop()
    },
    /** Drops the hand in progress without scoring it. */
    newHand: clearHand,
    /** Records the finished hand's score. A tranque needs to be told who won it. */
    finishHand(tranqueWinner?: Team) {
      if (!setup.value || !state.value) return
      hands.value.push(handLines(setup.value, state.value, settings.value, tranqueWinner))
      clearHand()
    },
    removeLastHand() {
      hands.value.pop()
    },
    resetScore() {
      hands.value = []
    },
  }
}
