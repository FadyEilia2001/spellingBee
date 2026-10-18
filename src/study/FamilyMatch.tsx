import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ALL_SPELLING_WORDS, entryForWord } from '../data/words.ts'
import { wordsForDifficulty, DIFFICULTIES, ROUND_COUNTS, type Difficulty, type RoundCount } from './difficulty.ts'
import {
  SEATS,
  type ClientMessage,
  type DuelView,
  type Seat,
  type SeatState,
} from './duel.ts'
import { isSolvedGuess, MAX_ATTEMPTS, type LetterMark } from './evaluateGuess.ts'
import { startRound } from './queue.ts'
import { maskSentence } from './sentenceClue.ts'
import { speakWord, stopSpeaking } from './speech.ts'
import { starsFor } from './progress.ts'
import { hushSoundtrack, restoreSoundtrack } from './soundtrack.ts'
import { slotCount } from './wordCycling.ts'

const touchTarget =
  'min-h-[52px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200'

const choiceButton = `${touchTarget} w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-lg font-semibold text-stone-100`

const markTone: Record<LetterMark, string> = {
  correct: 'border-green-300 bg-green-500 text-white',
  present: 'border-yellow-200 bg-yellow-400 text-stone-950',
  absent: 'border-slate-500 bg-slate-600 text-slate-100',
}

export type RoomConnection = {
  send: (message: ClientMessage) => void
  close: () => void
}

const DEFAULT_FAMILY_HOME = 'http://10.0.0.187:8787'

export function familyHomePageUrl(): string {
  const configured = import.meta.env.VITE_FAMILY_HOME_URL
  if (typeof configured === 'string' && configured.length > 0) return configured.replace(/\/$/, '')
  const duel = import.meta.env.VITE_DUEL_URL
  if (typeof duel === 'string' && duel.startsWith('ws://')) return `http://${duel.slice('ws://'.length)}`.replace(/\/$/, '')
  if (typeof duel === 'string' && duel.startsWith('wss://')) return `https://${duel.slice('wss://'.length)}`.replace(/\/$/, '')
  return DEFAULT_FAMILY_HOME
}

export function familyMatchLivesHere(): boolean {
  if (typeof location === 'undefined') return true
  try {
    return location.origin === new URL(familyHomePageUrl()).origin
  } catch {
    return location.protocol !== 'https:'
  }
}

export function familyRoomUrl(): string {
  if (typeof location !== 'undefined' && familyMatchLivesHere()) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${location.host}`
  }
  const configured = import.meta.env.VITE_DUEL_URL
  if (typeof configured === 'string' && configured.length > 0) return configured
  if (typeof location !== 'undefined' && location.host) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${location.host}`
  }
  return 'ws://127.0.0.1:8787'
}

export function connectFamilyRoom(
  onView: (view: DuelView) => void,
  onOpen: (open: boolean) => void,
): RoomConnection {
  const socket = new WebSocket(familyRoomUrl())
  socket.addEventListener('open', () => onOpen(true))
  socket.addEventListener('close', () => onOpen(false))
  socket.addEventListener('message', (event) => {
    const parsed = JSON.parse(String(event.data)) as { view?: DuelView }
    if (parsed.view) onView(parsed.view)
  })
  return {
    send: (message) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
    },
    close: () => socket.close(),
  }
}

export function FamilyMatch({
  onBack,
  host = true,
  connect = connectFamilyRoom,
}: {
  onBack: () => void
  host?: boolean
  connect?: (onView: (view: DuelView) => void, onOpen: (open: boolean) => void) => RoomConnection
}) {
  const [view, setView] = useState<DuelView | null>(null)
  const [open, setOpen] = useState<boolean | null>(null)
  const [draft, setDraft] = useState('')
  const [clueOpen, setClueOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const connection = useRef<RoomConnection | null>(null)
  const guessRef = useRef<HTMLInputElement>(null)
  const celebrated = useRef<string | null>(null)

  useEffect(() => {
    hushSoundtrack()
    return () => restoreSoundtrack()
  }, [])

  useEffect(() => {
    let active = true
    const room = connect(
      (next) => {
        if (active) setView(next)
      },
      (nextOpen) => {
        if (active) setOpen(nextOpen)
      },
    )
    connection.current = room
    return () => {
      active = false
      stopSpeaking()
      room.close()
    }
  }, [connect])

  const you = view?.you ?? null
  const mine = you ? view?.seats[you] : null
  const word = view?.word ?? ''
  const locked = mine?.locked === true
  const entry = word ? entryForWord(word) : undefined

  useEffect(() => {
    if (!view || !you || !mine?.locked || view.phase === 'lobby') return
    const mark = `${view.index}:${mine.attempts.length}`
    if (celebrated.current === mark) return
    celebrated.current = mark
    const solved = mine.attempts.some((attempt) => isSolvedGuess(attempt.guess, view.word ?? ''))
    if (!solved && view.word) speakWord(view.word)
  }, [mine?.attempts.length, mine?.locked, view, you])

  function send(message: ClientMessage) {
    connection.current?.send(message)
  }

  function submitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const guess = draft.trim()
    if (!guess || locked || Array.from(guess).length !== Array.from(word).length) return
    send({ type: 'guess', guess })
    setDraft('')
  }

  function startGame() {
    if (!view?.difficulty || !view.count) return
    const words = startRound(wordsForDifficulty(ALL_SPELLING_WORDS, view.difficulty), view.count).started
    send({ type: 'start', words })
    setDraft('')
    setClueOpen(false)
  }

  const seatedCount = SEATS.filter((seat) => view?.seats[seat]?.connected).length
  const triesLeft = MAX_ATTEMPTS - (mine?.attempts.length ?? 0)
  const solved = mine?.attempts.some((attempt) => isSolvedGuess(attempt.guess, word)) === true

  useEffect(() => {
    setDraft('')
    setClueOpen(false)
  }, [view?.index, view?.phase])

  return (
    <div className="mt-6" data-testid="family-match">
      <Scoreboard view={view} />
      {open === false ? (
        <p className="mt-6 text-center text-lg text-stone-200" data-testid="room-offline">
          The family room is not reachable on this page. On home Wi-Fi, open{' '}
          <a className="font-semibold text-amber-200 underline" href={familyHomePageUrl()}>
            {familyHomePageUrl()}
          </a>
          .
        </p>
      ) : null}
      {open === null ? <p className="mt-6 text-center text-lg text-stone-200">One moment</p> : null}
      {open && you === null ? (
        <SeatPicker
          seats={view?.seats}
          phase={view?.phase ?? 'lobby'}
          host={host}
          onSit={(seat) => send({ type: 'sit', seat })}
          onStartOver={() => send({ type: 'abandon' })}
        />
      ) : null}
      {open && you !== null && view?.phase === 'lobby' ? (
        <Lobby
          view={view}
          host={host}
          seatedCount={seatedCount}
          onOptions={(difficulty, count) => send({ type: 'options', difficulty, count })}
          onStart={startGame}
          confirmClear={confirmClear}
          onAskClear={() => setConfirmClear(true)}
          onClear={() => {
            send({ type: 'clear' })
            setConfirmClear(false)
          }}
        />
      ) : null}
      {open && you !== null && view && (view.phase === 'spelling' || view.phase === 'reveal') && word ? (
        <div className="mt-6">
          <p className="text-center text-sm text-stone-400">
            Word {Math.min(view.index + 1, view.totalWords)} of {view.totalWords}
          </p>
          {view.phase === 'spelling' ? (
            <>
              <button
                type="button"
                className={`${touchTarget} mt-4 w-full rounded-2xl bg-amber-400 px-3 text-lg font-semibold text-[#1c1406]`}
                onClick={() => speakWord(word)}
              >
                Hear Word
              </button>
              <button
                type="button"
                className={`${touchTarget} mt-3 w-full rounded-2xl border border-amber-200/30 bg-amber-400/15 px-3 text-base font-semibold text-amber-100`}
                onClick={() => setClueOpen(true)}
              >
                In a Sentence
              </button>
              {clueOpen && entry ? (
                <aside data-testid="sentence-clue" className="mt-4 rounded-2xl border border-amber-200/25 bg-[#0e1210] px-4 py-4 text-left">
                  <p className="text-base text-stone-100">{entry.definition}</p>
                  <p data-testid="clue-sentence" className="mt-2 text-lg text-amber-100">
                    {maskSentence(entry.sentence, entry.word)}
                  </p>
                </aside>
              ) : null}
              <TryLadder active={activeTry(mine, locked, solved)} />
              {mine && mine.attempts.length > 0 ? <YourTries attempts={mine.attempts} /> : null}
              {locked ? null : (
                <form onSubmit={submitGuess} className="mt-5">
                  <label htmlFor="family-guess" className="sr-only">
                    Spell the word
                  </label>
                  <div className="relative">
                    <LetterBoxes word={word} draft={draft} />
                    <input
                      ref={guessRef}
                      id="family-guess"
                      value={draft}
                      maxLength={Array.from(word).length}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      style={{ fontSize: '18px' }}
                      className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
                      onChange={(event) =>
                        setDraft(Array.from(event.target.value).slice(0, Array.from(word).length).join(''))
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={Array.from(draft.trim()).length !== Array.from(word).length}
                    className={`${touchTarget} mt-3 w-full rounded-2xl bg-white/10 px-5 text-lg font-semibold text-stone-50 disabled:opacity-40`}
                  >
                    Spell
                  </button>
                </form>
              )}
              <p className="mt-4 text-center text-lg text-stone-200">
                {locked
                  ? `${solved ? 'You got it.' : 'Not this time.'} ${waitingFor(view, you)}`.trim()
                  : mine && mine.attempts.length > 0
                    ? `Not quite. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`
                    : `Listen, then spell it. ${triesLeft} tries left.`}
              </p>
            </>
          ) : (
            <WordResult
              view={view}
              onNext={() => {
                stopSpeaking()
                setDraft('')
                setClueOpen(false)
                send({ type: 'next' })
              }}
            />
          )}
        </div>
      ) : null}
      {open && you !== null && view?.phase === 'done' ? (
        <Finale view={view} onAgain={() => send({ type: 'again' })} />
      ) : null}
      {host && (you === null || !view || view.phase === 'lobby') ? (
        <button
          type="button"
          className={`${touchTarget} mt-6 w-full rounded-2xl border border-white/10 px-4 text-base font-semibold text-stone-300`}
          onClick={() => {
            send({ type: 'leave' })
            onBack()
          }}
        >
          Back
        </button>
      ) : !host && you !== null && view?.phase === 'lobby' ? (
        <button
          type="button"
          className={`${touchTarget} mt-6 w-full rounded-2xl border border-white/10 px-4 text-base font-semibold text-stone-300`}
          onClick={() => send({ type: 'leave' })}
        >
          Change seat
        </button>
      ) : null}
    </div>
  )
}

function Scoreboard({ view }: { view: DuelView | null }) {
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="scoreboard">
      {SEATS.map((seat) => {
        const player = view?.seats[seat]
        return (
          <p key={seat} className="rounded-2xl border border-white/10 bg-[#0e1210] px-2 py-3 text-center">
            <span className="block text-sm font-semibold text-stone-200">{seat}</span>
            <span className="mt-1 block font-serif text-3xl text-amber-200" data-testid={`${seat}-game`}>
              {view && view.phase !== 'lobby' && player ? player.gameScore : '–'}
            </span>
            <span className="block text-xs text-stone-400">this game</span>
            <span className="mt-2 block text-lg font-semibold text-green-300" data-testid={`${seat}-overall`}>
              {view?.overall[seat] ?? 0}
            </span>
            <span className="block text-xs text-stone-400">overall</span>
          </p>
        )
      })}
    </div>
  )
}

function SeatPicker({
  seats,
  phase,
  host,
  onSit,
  onStartOver,
}: {
  seats: DuelView['seats'] | undefined
  phase: DuelView['phase']
  host: boolean
  onSit: (seat: Seat) => void
  onStartOver: () => void
}) {
  const choices = SEATS.filter((seat) => {
    const player = seats?.[seat]
    if (phase !== 'lobby') return player !== null && player !== undefined && player.connected !== true
    return host || player?.connected !== true
  })
  return (
    <div className="mt-6">
      <p className="text-center text-xl font-semibold text-stone-50">
        {phase !== 'lobby' && choices.length === 0 ? 'This game already started.' : seatPrompt(seats, host)}
      </p>
      {phase !== 'lobby' && choices.length > 0 ? (
        <p className="mt-2 text-center text-lg text-stone-200">Pick your seat to jump back in.</p>
      ) : null}
      <div className="mt-4 grid gap-3">
        {choices.map((seat) => {
          const taken = seats?.[seat]?.connected === true
          return (
            <button key={seat} type="button" className={choiceButton} disabled={taken} onClick={() => onSit(seat)}>
              {taken ? `${seat} is here` : seat}
            </button>
          )
        })}
      </div>
      {phase !== 'lobby' ? (
        <button
          type="button"
          className={`${touchTarget} mt-4 w-full rounded-2xl border border-white/10 px-4 text-base font-semibold text-stone-300`}
          onClick={onStartOver}
        >
          Start over
        </button>
      ) : null}
    </div>
  )
}

function Lobby({
  view,
  host,
  seatedCount,
  onOptions,
  onStart,
  onClear,
  confirmClear,
  onAskClear,
}: {
  view: DuelView
  host: boolean
  seatedCount: number
  onOptions: (difficulty: Difficulty, count: RoundCount) => void
  onStart: () => void
  onClear: () => void
  confirmClear: boolean
  onAskClear: () => void
}) {
  const names = nameList(SEATS.filter((seat) => view.seats[seat]?.connected))
  if (!host) {
    const picked = DIFFICULTIES.find((item) => item.id === view.difficulty)
    const setup = picked && view.count ? `${picked.label} · ${view.count} words. ` : ''
    return <p className="mt-6 text-center text-lg text-stone-200">{setup}Waiting for the game to start.</p>
  }
  return (
    <div className="mt-6">
      <p className="text-center text-lg text-stone-200">
        {names || 'Waiting'} {seatedCount === 1 ? 'is here' : 'are here'}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {DIFFICULTIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={view.difficulty === item.id}
            className={`${touchTarget} rounded-2xl border px-2 text-base font-semibold ${
              view.difficulty === item.id ? 'border-amber-300 bg-amber-400 text-[#1c1406]' : 'border-white/10 bg-white/5 text-stone-100'
            }`}
            onClick={() => onOptions(item.id, view.count ?? 5)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {ROUND_COUNTS.map((count) => (
          <button
            key={count}
            type="button"
            aria-pressed={view.count === count}
            className={`${touchTarget} rounded-2xl border px-2 text-base font-semibold ${
              view.count === count ? 'border-amber-300 bg-amber-400 text-[#1c1406]' : 'border-white/10 bg-white/5 text-stone-100'
            }`}
            onClick={() => onOptions(view.difficulty ?? 'short', count)}
          >
            {count} words
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`${touchTarget} mt-4 w-full rounded-2xl bg-amber-400 px-4 text-lg font-semibold text-[#1c1406] disabled:opacity-40`}
        disabled={seatedCount < 2 || view.difficulty === null || view.count === null}
        onClick={onStart}
      >
        Start
      </button>
      {confirmClear ? (
        <button
          type="button"
          className={`${touchTarget} mt-3 w-full rounded-2xl border border-white/10 px-4 text-base font-semibold text-stone-300`}
          onClick={onClear}
        >
          Yes, clear the overall scores
        </button>
      ) : (
        <button
          type="button"
          className={`${touchTarget} mt-3 w-full rounded-2xl border border-white/10 px-4 text-base font-semibold text-stone-300`}
          onClick={onAskClear}
        >
          Clear overall scores
        </button>
      )}
    </div>
  )
}

function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function seatPrompt(seats: DuelView['seats'] | undefined, host: boolean): string {
  if (host) return 'Who are you?'
  const here = nameList(SEATS.filter((seat) => seats?.[seat]?.connected))
  return here ? `Join ${here}. Who are you?` : 'Who are you?'
}

function othersStillSpelling(view: DuelView, you: Seat | null): string[] {
  return SEATS.filter((seat) => seat !== you && view.seats[seat]?.connected && view.seats[seat]?.locked !== true)
}

function waitingFor(view: DuelView, you: Seat | null): string {
  const pending = othersStillSpelling(view, you)
  if (pending.length === 0) return ''
  return `Waiting for ${nameList(pending)}.`
}

const TRY_STEPS = [
  { label: 'First try', points: 3 },
  { label: 'Second try', points: 2 },
  { label: 'Third try', points: 1 },
] as const

function activeTry(player: SeatState | null | undefined, locked: boolean, solved: boolean): number | null {
  const used = player?.attempts.length ?? 0
  if (locked) return solved ? used - 1 : null
  return Math.min(used, TRY_STEPS.length - 1)
}

function TryLadder({ active }: { active: number | null }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2" data-testid="try-ladder">
      {TRY_STEPS.map((step, index) => {
        const on = active === index
        return (
          <p
            key={step.label}
            className={`rounded-2xl border px-2 py-3 text-center ${
              on ? 'border-amber-300 bg-amber-400 text-[#1c1406]' : 'border-white/10 bg-[#0e1210] text-stone-200'
            }`}
          >
            <span className="block text-sm font-semibold">{step.label}</span>
            <span className="mt-1 block font-serif text-3xl">{step.points}</span>
          </p>
        )
      })}
    </div>
  )
}

function LetterBoxes({ word, draft }: { word: string; draft: string }) {
  const characters = Array.from(word)
  const typed = Array.from(draft)
  return (
    <div
      className="pointer-events-none flex min-h-16 flex-wrap items-center justify-center gap-1.5"
      aria-label={`${slotCount(word)} characters`}
    >
      {characters.map((character, index) => {
        const letter = typed[index] ?? ''
        const isNext = index === typed.length
        return (
          <span
            key={`${word}-${index}`}
            data-testid="letter-slot"
            aria-hidden="true"
            className={
              character === ' ' && (letter === '' || letter === ' ')
                ? 'mx-1 h-11 w-2'
                : `flex h-11 w-7 items-center justify-center rounded-md border bg-[#0e1210] text-lg font-bold text-stone-50 sm:w-9 ${
                    isNext ? 'border-amber-300 ring-2 ring-amber-300/70' : 'border-amber-100/25'
                  }`
            }
          >
            {letter === ' ' ? '' : letter}
          </span>
        )
      })}
    </div>
  )
}

function outcome(player: SeatState): { line: string; points: number } {
  const solved = player.attempts.some((attempt) => attempt.marks.every((mark) => mark === 'correct'))
  if (!player.locked && !solved) return { line: 'stepped away', points: 0 }
  const points = starsFor(player.attempts.length, solved)
  if (points === 3) return { line: 'got it on the first try', points }
  if (points === 2) return { line: 'got it on the second try', points }
  if (points === 1) return { line: 'got it on the third try', points }
  return { line: 'missed', points: 0 }
}

function winnerLine(view: DuelView): string {
  const players = SEATS.flatMap((seat) => {
    const player = view.seats[seat]
    return player ? [{ seat, score: player.gameScore }] : []
  })
  if (players.length === 0) return 'Nice spelling'
  const best = Math.max(...players.map((player) => player.score))
  const winners = players.filter((player) => player.score === best).map((player) => player.seat)
  if (winners.length === 1) return `${winners[0]} wins`
  return `${nameList(winners)} tied`
}

function YourTries({ attempts }: { attempts: SeatState['attempts'] }) {
  return (
    <ol className="mt-4 flex flex-col items-center gap-2" aria-label="Your tries">
      {attempts.map((attempt, attemptIndex) => (
        <li key={`${attempt.guess}-${attemptIndex}`} className="flex flex-wrap justify-center gap-1.5">
          {Array.from(attempt.guess).map((character, tileIndex) => (
            <span
              key={`${attemptIndex}-${tileIndex}`}
              data-testid="attempt-tile"
              data-status={attempt.marks[tileIndex]}
              className={`flex h-11 w-7 items-center justify-center rounded-md border text-lg font-bold sm:w-9 ${markTone[attempt.marks[tileIndex] ?? 'absent']}`}
            >
              {character === ' ' ? '' : character}
            </span>
          ))}
        </li>
      ))}
    </ol>
  )
}

function readyLabel(view: DuelView, idle: string): string {
  const you = view.you
  if (!you || !view.ready.includes(you)) return idle
  const pending = SEATS.filter((seat) => view.seats[seat]?.connected && !view.ready.includes(seat))
  return pending.length > 0 ? `Waiting for ${nameList(pending)}` : idle
}

function standings(view: DuelView): string {
  const players = SEATS.flatMap((seat) => {
    const player = view.seats[seat]
    return player ? [{ seat, score: player.gameScore }] : []
  })
  if (players.length === 0) return ''
  const best = Math.max(...players.map((player) => player.score))
  const leaders = players.filter((player) => player.score === best).map((player) => player.seat)
  if (leaders.length === players.length) return 'Tied'
  if (leaders.length === 1) return `${leaders[0]} is ahead`
  return `${nameList(leaders)} are ahead`
}

function WordResult({ view, onNext }: { view: DuelView; onNext: () => void }) {
  const entry = view.word ? entryForWord(view.word) : undefined
  const lastWord = view.index + 1 >= view.totalWords
  const idle = lastWord ? 'See who won' : 'Next word'
  const label = readyLabel(view, idle)
  const waiting = label !== idle
  return (
    <div className="mt-4 text-center">
      <p data-testid="revealed-word" className="font-serif text-5xl text-amber-200">
        {view.word}
      </p>
      {entry ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#0e1210] px-4 py-4 text-left">
          <p className="text-base text-stone-100">{entry.definition}</p>
          <p className="mt-2 text-lg text-amber-100">{entry.sentence}</p>
        </div>
      ) : null}
      <ul className="mt-5 space-y-2">
        {SEATS.map((seat) => {
          const player = view.seats[seat]
          if (!player) return null
          const result = outcome(player)
          const gotIt = result.points > 0
          return (
            <li key={seat} className={`text-xl font-semibold ${gotIt ? 'text-green-300' : 'text-stone-300'}`}>
              {seat} {result.line} · {result.points}
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-lg font-semibold text-amber-100">{standings(view)}</p>
      <button
        type="button"
        className={`${touchTarget} mt-5 w-full rounded-2xl bg-amber-400 px-4 text-lg font-semibold text-[#1c1406]`}
        onClick={() => {
          speakWord(view.word ?? '')
        }}
      >
        Hear it again
      </button>
      <button
        type="button"
        disabled={waiting}
        className={`${touchTarget} mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-base font-semibold disabled:opacity-60`}
        onClick={onNext}
      >
        {label}
      </button>
    </div>
  )
}

function Finale({ view, onAgain }: { view: DuelView; onAgain: () => void }) {
  const label = readyLabel(view, 'Play again')
  const waiting = label !== 'Play again'
  return (
    <div className="mt-8 text-center">
      <p className="font-serif text-4xl text-amber-200">{winnerLine(view)}</p>
      <ul className="mt-6 space-y-3 text-left">
        {view.history.map((item, index) => (
          <li key={`${item.word}-${index}`} className="rounded-2xl border border-white/10 bg-[#0e1210] px-4 py-3">
            <p className="text-2xl font-semibold text-amber-100">{item.word}</p>
            <p className="mt-1 text-base text-stone-200">
              {SEATS.filter((seat) => item.points[seat] !== null)
                .map((seat) => `${seat} ${item.points[seat]}`)
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={waiting}
        className={`${touchTarget} mt-6 w-full rounded-2xl bg-amber-400 px-4 text-lg font-semibold text-[#1c1406] disabled:opacity-60`}
        onClick={onAgain}
      >
        {label}
      </button>
    </div>
  )
}
