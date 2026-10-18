import type { Difficulty, RoundCount } from './difficulty.ts'
import { evaluateGuess, isSolvedGuess, MAX_ATTEMPTS, type LetterMark } from './evaluateGuess.ts'
import { starsFor } from './progress.ts'

export const SEATS = ['Ella', 'Mom', 'Dad'] as const
export type Seat = (typeof SEATS)[number]

export type DuelAttempt = {
  guess: string
  marks: LetterMark[]
}

export type SeatState = {
  connected: boolean
  attempts: DuelAttempt[]
  locked: boolean
  gameScore: number
}

export type WordScore = {
  word: string
  points: Record<Seat, number | null>
}

export type DuelPhase = 'lobby' | 'spelling' | 'reveal' | 'done'

export type DuelMatch = {
  phase: DuelPhase
  words: string[]
  index: number
  difficulty: Difficulty | null
  count: RoundCount | null
  seats: Record<Seat, SeatState | null>
  overall: Record<Seat, number>
  history: WordScore[]
  ready: Seat[]
}

export type DuelView = {
  phase: DuelPhase
  word: string | null
  index: number
  totalWords: number
  difficulty: Difficulty | null
  count: RoundCount | null
  you: Seat | null
  seats: Record<Seat, SeatState | null>
  overall: Record<Seat, number>
  history: WordScore[]
  ready: Seat[]
}

export type ClientMessage =
  | { type: 'sit'; seat: Seat }
  | { type: 'leave' }
  | { type: 'options'; difficulty: Difficulty; count: RoundCount }
  | { type: 'start'; words: string[] }
  | { type: 'guess'; guess: string }
  | { type: 'next' }
  | { type: 'again' }
  | { type: 'clear' }
  | { type: 'abandon' }

const DIFFICULTIES: readonly Difficulty[] = ['short', 'medium', 'long']
const COUNTS: readonly RoundCount[] = [5, 10, 15]

export function roomHasCompany(view: {
  phase: DuelPhase
  seats: Record<Seat, { connected: boolean } | null>
}): boolean {
  if (view.phase !== 'lobby') return true
  return SEATS.some((seat) => view.seats[seat]?.connected === true)
}

export function isSeat(value: unknown): value is Seat {
  return value === 'Ella' || value === 'Mom' || value === 'Dad'
}

export function emptyOverall(): Record<Seat, number> {
  return { Ella: 0, Mom: 0, Dad: 0 }
}

export function readOverall(raw: string): Record<Seat, number> {
  const overall = emptyOverall()
  try {
    const parsed = JSON.parse(raw) as Partial<Record<Seat, unknown>>
    for (const seat of SEATS) {
      const value = parsed[seat]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) overall[seat] = value
    }
  } catch {
    return emptyOverall()
  }
  return overall
}

export function readMatch(raw: string, fallbackOverall: Record<Seat, number>): DuelMatch {
  const blank = emptyMatch(fallbackOverall)
  try {
    const parsed = JSON.parse(raw) as Partial<DuelMatch>
    const phase = parsed.phase
    if (phase !== 'lobby' && phase !== 'spelling' && phase !== 'reveal' && phase !== 'done') return blank
    const overall = readOverall(JSON.stringify(parsed.overall ?? fallbackOverall))
    const seats = { Ella: null, Mom: null, Dad: null } as Record<Seat, SeatState | null>
    for (const seat of SEATS) {
      const player = parsed.seats?.[seat]
      if (!player) continue
      const attempts = Array.isArray(player.attempts)
        ? player.attempts.filter(
            (attempt) =>
              typeof attempt?.guess === 'string' &&
              Array.isArray(attempt.marks) &&
              attempt.marks.every((mark) => mark === 'correct' || mark === 'present' || mark === 'absent'),
          )
        : []
      seats[seat] = {
        connected: false,
        attempts,
        locked: player.locked === true,
        gameScore: typeof player.gameScore === 'number' && player.gameScore >= 0 ? player.gameScore : 0,
      }
    }
    const history = Array.isArray(parsed.history)
      ? parsed.history.flatMap((item) => {
          if (!item || typeof item.word !== 'string') return []
          const points = { Ella: null, Mom: null, Dad: null } as Record<Seat, number | null>
          for (const seat of SEATS) {
            const score = item.points?.[seat]
            points[seat] = typeof score === 'number' && score >= 0 ? score : null
          }
          return [{ word: item.word, points }]
        })
      : []
    const difficulty = parsed.difficulty === 'short' || parsed.difficulty === 'medium' || parsed.difficulty === 'long' ? parsed.difficulty : null
    const count = parsed.count === 5 || parsed.count === 10 || parsed.count === 15 ? parsed.count : null
    return {
      phase,
      words: Array.isArray(parsed.words) ? parsed.words.filter((word) => typeof word === 'string') : [],
      index: typeof parsed.index === 'number' && parsed.index >= 0 ? parsed.index : 0,
      difficulty,
      count,
      seats,
      overall,
      history,
      ready: [],
    }
  } catch {
    return blank
  }
}

export function emptyMatch(overall: Record<Seat, number> = emptyOverall()): DuelMatch {
  return {
    phase: 'lobby',
    words: [],
    index: 0,
    difficulty: null,
    count: null,
    seats: { Ella: null, Mom: null, Dad: null },
    overall: { ...overall },
    history: [],
    ready: [],
  }
}

function freshSeat(): SeatState {
  return { connected: true, attempts: [], locked: false, gameScore: 0 }
}

function connectedPlayers(match: DuelMatch): Seat[] {
  return SEATS.filter((seat) => match.seats[seat]?.connected)
}

export function currentWord(match: DuelMatch): string | null {
  if (match.phase === 'lobby' || match.words.length === 0) return null
  return match.words[Math.min(match.index, match.words.length - 1)] ?? null
}

function settle(match: DuelMatch): DuelMatch {
  if (match.phase === 'spelling') return maybeReveal(match)
  if (match.phase === 'reveal' || match.phase === 'done') return finishReady(match)
  return match
}

export function sit(match: DuelMatch, seat: Seat): DuelMatch {
  const current = match.seats[seat]
  if (match.phase === 'lobby') {
    if (current?.connected) return match
    return {
      ...match,
      seats: {
        ...match.seats,
        [seat]: current ? { ...current, connected: true } : freshSeat(),
      },
    }
  }
  if (current && !current.connected) {
    return settle({ ...match, seats: { ...match.seats, [seat]: { ...current, connected: true } } })
  }
  return match
}

export function leave(match: DuelMatch, seat: Seat): DuelMatch {
  const current = match.seats[seat]
  if (!current) return match
  if (match.phase === 'lobby') {
    return { ...match, seats: { ...match.seats, [seat]: null } }
  }
  const next = settle({ ...match, seats: { ...match.seats, [seat]: { ...current, connected: false } } })
  if (connectedPlayers(next).length === 0) return emptyMatch(next.overall)
  return next
}

export function abandonMatch(match: DuelMatch): DuelMatch {
  if (match.phase === 'lobby') return match
  return emptyMatch(match.overall)
}

export function setOptions(match: DuelMatch, difficulty: Difficulty, count: RoundCount): DuelMatch {
  if (match.phase !== 'lobby') return match
  if (!DIFFICULTIES.includes(difficulty) || !COUNTS.includes(count)) return match
  return { ...match, difficulty, count }
}

export function startMatch(match: DuelMatch, words: readonly string[]): DuelMatch {
  if (match.phase !== 'lobby') return match
  if (connectedPlayers(match).length < 2) return match
  const playable = words.filter((word) => typeof word === 'string' && word.trim() !== '').slice(0, 15)
  if (playable.length === 0) return match
  const seats = { ...match.seats }
  for (const seat of SEATS) {
    const player = seats[seat]
    if (player) seats[seat] = { ...player, attempts: [], locked: false, gameScore: 0 }
  }
  return { ...match, phase: 'spelling', words: playable, index: 0, seats, history: [], ready: [] }
}

function maybeReveal(match: DuelMatch): DuelMatch {
  if (match.phase !== 'spelling') return match
  const active = connectedPlayers(match)
  if (active.length === 0 || !active.every((seat) => match.seats[seat]?.locked)) return match
  const word = currentWord(match) ?? ''
  const seats = { ...match.seats }
  const overall = { ...match.overall }
  const points = { Ella: null, Mom: null, Dad: null } as Record<Seat, number | null>
  for (const seat of SEATS) {
    const player = seats[seat]
    if (!player) continue
    const solved = player.locked && player.attempts.some((attempt) => isSolvedGuess(attempt.guess, word))
    const earned = player.locked ? starsFor(player.attempts.length, solved) : 0
    if (player.locked) {
      seats[seat] = { ...player, gameScore: player.gameScore + earned }
      overall[seat] = overall[seat] + earned
    }
    points[seat] = earned
  }
  return {
    ...match,
    phase: 'reveal',
    seats,
    overall,
    history: [...match.history, { word, points }],
    ready: [],
  }
}

export function submitGuess(match: DuelMatch, seat: Seat, guess: string): DuelMatch {
  const word = currentWord(match)
  const player = match.seats[seat]
  const trimmed = guess.trim()
  if (match.phase !== 'spelling' || !word || !player?.connected || player.locked || trimmed === '') return match
  if (Array.from(trimmed).length !== Array.from(word).length) return match
  if (player.attempts.length >= MAX_ATTEMPTS) return match

  const attempts = [...player.attempts, { guess: trimmed, marks: evaluateGuess(trimmed, word) }]
  const solved = isSolvedGuess(trimmed, word)
  if (!solved && attempts.length < MAX_ATTEMPTS) {
    return { ...match, seats: { ...match.seats, [seat]: { ...player, attempts } } }
  }

  const next: DuelMatch = {
    ...match,
    seats: {
      ...match.seats,
      [seat]: { ...player, attempts, locked: true },
    },
  }
  return maybeReveal(next)
}

function clearAttempts(match: DuelMatch): Record<Seat, SeatState | null> {
  const seats = { ...match.seats }
  for (const seat of SEATS) {
    const player = seats[seat]
    if (player) seats[seat] = { ...player, attempts: [], locked: false }
  }
  return seats
}

export function advance(match: DuelMatch): DuelMatch {
  if (match.phase !== 'reveal') return match
  const nextIndex = match.index + 1
  if (nextIndex >= match.words.length) {
    return { ...match, phase: 'done', index: match.words.length, seats: clearAttempts(match), ready: [] }
  }
  return { ...match, phase: 'spelling', index: nextIndex, seats: clearAttempts(match), ready: [] }
}

function finishReady(match: DuelMatch): DuelMatch {
  const active = connectedPlayers(match)
  if (active.length === 0 || !active.every((seat) => match.ready.includes(seat))) return match
  if (match.phase === 'reveal') return advance(match)
  if (match.phase === 'done') return backToLobby(match)
  return match
}

export function readyNext(match: DuelMatch, seat: Seat): DuelMatch {
  if ((match.phase !== 'reveal' && match.phase !== 'done') || !match.seats[seat]?.connected) return match
  if (match.ready.includes(seat)) return match
  return settle({ ...match, ready: [...match.ready, seat] })
}

export function clearOverall(match: DuelMatch): DuelMatch {
  if (match.phase !== 'lobby') return match
  return { ...match, overall: emptyOverall() }
}

export function backToLobby(match: DuelMatch): DuelMatch {
  if (match.phase !== 'done') return match
  const seats = { ...match.seats }
  for (const seat of SEATS) {
    const player = seats[seat]
    if (!player?.connected) {
      seats[seat] = null
      continue
    }
    seats[seat] = freshSeat()
  }
  return { ...match, phase: 'lobby', words: [], index: 0, seats, history: [], ready: [] }
}

export function viewFor(match: DuelMatch, viewer: Seat | null): DuelView {
  const showGuesses = match.phase === 'reveal' || match.phase === 'done'
  const seats = { ...match.seats }
  if (!showGuesses) {
    for (const seat of SEATS) {
      const player = seats[seat]
      if (!player || seat === viewer) continue
      seats[seat] = { ...player, attempts: [] }
    }
  }
  return {
    phase: match.phase,
    word: currentWord(match),
    index: match.phase === 'lobby' ? 0 : Math.min(match.index, Math.max(match.words.length - 1, 0)),
    totalWords: match.words.length,
    difficulty: match.difficulty,
    count: match.count,
    you: viewer,
    seats,
    overall: match.overall,
    history: match.history,
    ready: match.ready,
  }
}

export function applyMessage(
  match: DuelMatch,
  seat: Seat | null,
  message: ClientMessage,
): { match: DuelMatch; seat: Seat | null } {
  if (message.type === 'sit') {
    if (!isSeat(message.seat) || seat !== null) return { match, seat }
    const next = sit(match, message.seat)
    const took = next.seats[message.seat]?.connected === true && next !== match
    return took ? { match: next, seat: message.seat } : { match, seat }
  }
  if (message.type === 'leave') {
    if (seat === null) return { match, seat }
    return { match: leave(match, seat), seat: null }
  }
  if (message.type === 'abandon') {
    return { match: abandonMatch(match), seat: null }
  }
  if (seat === null) return { match, seat }
  if (message.type === 'options') return { match: setOptions(match, message.difficulty, message.count), seat }
  if (message.type === 'start') return { match: startMatch(match, message.words), seat }
  if (message.type === 'guess') return { match: submitGuess(match, seat, message.guess), seat }
  if (message.type === 'next') return { match: readyNext(match, seat), seat }
  if (message.type === 'again') return { match: readyNext(match, seat), seat }
  if (message.type === 'clear') return { match: clearOverall(match), seat }
  return { match, seat }
}
