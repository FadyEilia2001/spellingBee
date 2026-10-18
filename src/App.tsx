import { useEffect, useRef, useState, type FormEvent } from 'react'
import confetti from 'canvas-confetti'
import { ChevronRight, Flame, Star, Volume2, VolumeX } from 'lucide-react'
import { ALL_SPELLING_WORDS, entryForWord } from './data/words.ts'
import { wordsForPage } from './data/pages.ts'
import {
  evaluateGuess,
  isSolvedGuess,
  MAX_ATTEMPTS,
  type LetterMark,
} from './study/evaluateGuess.ts'
import { wordsForDifficulty, type Difficulty, type RoundCount } from './study/difficulty.ts'
import { ChoiceScreen } from './study/ChoiceScreen.tsx'
import {
  connectFamilyRoom,
  FamilyMatch,
  familyHomePageUrl,
  familyMatchLivesHere,
} from './study/FamilyMatch.tsx'
import { roomHasCompany } from './study/duel.ts'
import {
  appendRoundHistory,
  loadProgress,
  recordTurn,
  saveProgress,
  starsFor,
  type Progress,
} from './study/progress.ts'
import {
  cleanCount,
  finishTurn,
  isSessionComplete,
  sessionTally,
  startQueue,
  startRound,
  type StudyQueue,
} from './study/queue.ts'
import { maskSentence } from './study/sentenceClue.ts'
import { speakWord, stopSpeaking } from './study/speech.ts'
import { readMusicPreference } from './study/lines.ts'
import {
  playEffect,
  playLine,
  pauseTune,
  resumeTune,
  hushSoundtrack,
  startTune,
  stopLine,
} from './study/soundtrack.ts'
import { slotCount } from './study/wordCycling.ts'

type Attempt = {
  guess: string
  marks: LetterMark[]
}

type SessionSummary = {
  stars: number
  cleanOnFirstAppearance: number
  cleanAfterReturn: number
  setAside: number
}

const markTone: Record<LetterMark, string> = {
  correct: 'border-green-300 bg-green-500 text-white',
  present: 'border-yellow-200 bg-yellow-400 text-stone-950',
  absent: 'border-slate-500 bg-slate-600 text-slate-100',
}

const touchTarget =
  'min-h-[52px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200'

function SentenceClue({
  definition,
  sentence,
  onDismiss,
}: {
  definition: string
  sentence: string
  onDismiss: () => void
}) {
  return (
    <aside
      data-testid="sentence-clue"
      aria-live="polite"
      className="mt-5 rounded-2xl border border-amber-200/25 bg-[#0e1210] px-4 py-4 text-left"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.22em] text-amber-200/80 uppercase">
          In a sentence
        </p>
        <button
          type="button"
          className={`${touchTarget} rounded-xl border border-white/10 px-4 text-sm font-semibold text-stone-200`}
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
      <p className="mt-3 text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase">Meaning</p>
      <p data-testid="clue-definition" className="mt-1 text-base leading-relaxed text-stone-100">
        {definition}
      </p>
      <p className="mt-3 text-xs font-semibold tracking-[0.16em] text-stone-500 uppercase">Sentence</p>
      <p data-testid="clue-sentence" className="mt-1 text-lg leading-relaxed text-amber-100">
        {sentence}
      </p>
    </aside>
  )
}

function streakLabel(streak: number): string {
  if (streak >= 10) return 'On fire'
  if (streak >= 6) return 'Heating up'
  if (streak >= 3) return 'On a roll'
  if (streak >= 1) return 'Warming up'
  return 'Start a streak'
}

function turnIsClean(attempts: Attempt[], word: string): boolean {
  const first = attempts[0]
  return attempts.length === 1 && first !== undefined && isSolvedGuess(first.guess, word)
}

function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [queue, setQueue] = useState<StudyQueue | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [recorded, setRecorded] = useState(false)
  const [draft, setDraft] = useState('')
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [sessionStars, setSessionStars] = useState(0)
  const [music, setMusic] = useState(readMusicPreference)
  const [clueOpen, setClueOpen] = useState(false)
  const [pageLesson, setPageLesson] = useState(false)
  const [family, setFamily] = useState(false)
  const [joining, setJoining] = useState(false)
  const [roomReady, setRoomReady] = useState(import.meta.env.MODE === 'test')
  const hostRef = useRef(false)
  const queueRef = useRef<StudyQueue | null>(null)
  const guessRef = useRef<HTMLInputElement>(null)

  queueRef.current = queue

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return
    if (!familyMatchLivesHere()) {
      setRoomReady(true)
      return
    }
    const timer = window.setTimeout(() => setRoomReady(true), 2000)
    const room = connectFamilyRoom((next) => {
      window.clearTimeout(timer)
      setRoomReady(true)
      if (hostRef.current || queueRef.current) return
      const company = roomHasCompany(next)
      if (company) hushSoundtrack()
      setJoining(company)
    }, (open) => {
      if (!open) setRoomReady(true)
    })
    return () => {
      window.clearTimeout(timer)
      room.close()
    }
  }, [])

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return
    if (!familyMatchLivesHere()) return
    if (new URLSearchParams(location.search).get('family') !== '1') return
    stopSpeaking()
    hushSoundtrack()
    hostRef.current = true
    setJoining(false)
    setFamily(true)
  }, [])

  const word = queue?.current ?? ''
  const characters = Array.from(word)
  const solved = attempts.some((attempt) => isSolvedGuess(attempt.guess, word))
  const failed = !solved && attempts.length >= MAX_ATTEMPTS
  const locked = solved || failed
  const entry = entryForWord(word)
  const pendingClean = queue !== null && recorded && turnIsClean(attempts, word)
  const shownClean = (queue ? cleanCount(queue) : 0) + (pendingClean ? 1 : 0)
  const remaining = queue ? queue.started.length - shownClean : 0

  useEffect(() => {
    startTune()
  }, [])

  useEffect(() => {
    if (!summary) return
    playEffect('complete')
    playLine('finished')
  }, [summary])

  function openSession(nextQueue: StudyQueue, page = false) {
    if (nextQueue.current === null) return
    stopSpeaking()
    stopLine()
    setQueue(nextQueue)
    setPageLesson(page)
    setAttempts([])
    setRecorded(false)
    setDraft('')
    setClueOpen(false)
    setSummary(null)
    setSessionStars(0)
  }

  function startDifficultyRound(difficulty: Difficulty, count: RoundCount) {
    openSession(startRound(wordsForDifficulty(ALL_SPELLING_WORDS, difficulty), count))
  }

  function showSentenceClue() {
    if (!entry) return
    setClueOpen(true)
    if (!locked) guessRef.current?.focus()
  }

  function submitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const guess = draft.trim()
    if (!guess || !queue?.current || locked) return

    const nextAttempts = [...attempts, { guess, marks: evaluateGuess(guess, word) }]
    const nowSolved = isSolvedGuess(guess, word)
    const nowLocked = nowSolved || nextAttempts.length >= MAX_ATTEMPTS
    setAttempts(nextAttempts)
    setDraft('')

    if (nowLocked && !recorded) {
      const nextProgress = recordTurn(progress, nextAttempts.length, nowSolved)
      saveProgress(nextProgress)
      setProgress(nextProgress)
      setSessionStars((current) => current + starsFor(nextAttempts.length, nowSolved))
      setRecorded(true)
      if (nowSolved) {
        playEffect('correct')
        playLine('yes')
      } else {
        playEffect('miss')
        speakWord(word)
      }
    }
  }

  function showNextWord() {
    if (!queue || !recorded) return
    stopSpeaking()
    const finished = finishTurn(queue, turnIsClean(attempts, word))
    if (isSessionComplete(finished)) {
      const tally = sessionTally(finished)
      const nextProgress = appendRoundHistory(progress, {
        stars: sessionStars,
        correct: tally.cleanOnFirstAppearance + tally.cleanAfterReturn,
        total: tally.started,
      })
      saveProgress(nextProgress)
      setProgress(nextProgress)
      setQueue(finished)
      setSummary({
        stars: sessionStars,
        cleanOnFirstAppearance: tally.cleanOnFirstAppearance,
        cleanAfterReturn: tally.cleanAfterReturn,
        setAside: tally.setAside,
      })
      void confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.65 },
        colors: ['#fbbf24', '#4ade80', '#fde68a'],
      })
      return
    }

    setQueue(finished)
    setAttempts([])
    setRecorded(false)
    setDraft('')
    setClueOpen(false)
  }

  function backToChoices() {
    stopSpeaking()
    setQueue(null)
    setAttempts([])
    setRecorded(false)
    setDraft('')
    setClueOpen(false)
    setSummary(null)
    setPageLesson(false)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0e1210] px-4 py-8 text-stone-100">
      <section className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[#171d1a] px-5 py-8 shadow-2xl sm:px-10 sm:py-10">
        <p className="text-center text-xs font-semibold tracking-[0.32em] text-amber-200/80 uppercase">
          Study
        </p>
        <h1 className="mt-3 text-center font-serif text-4xl text-stone-50 sm:text-5xl">
          Spelling Bee
        </h1>
        <div className="mt-5 rounded-2xl border border-white/10 bg-[#0e1210] px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <p className="flex items-center gap-2 text-amber-300">
              <Star aria-hidden="true" className="fill-amber-300" size={18} />
              <span data-testid="total-stars">{progress.totalStars}</span>
              <span className="font-medium text-stone-400">stars</span>
            </p>
            <button
              type="button"
              aria-label={music === 'playing' ? 'Pause music' : 'Play music'}
              className={`${touchTarget} rounded-2xl border border-white/10 px-3 text-sm font-semibold text-stone-200`}
              onClick={() => {
                if (music === 'playing') {
                  pauseTune()
                  setMusic('paused')
                } else {
                  resumeTune()
                  setMusic('playing')
                }
              }}
            >
              {music === 'playing' ? <Volume2 aria-hidden="true" size={18} /> : <VolumeX aria-hidden="true" size={18} />}
            </button>
            <p className="flex items-center gap-2 text-orange-300">
              <Flame
                aria-hidden="true"
                size={18}
                className={progress.currentStreak > 0 ? 'fill-orange-400' : ''}
              />
              <span data-testid="current-streak">{progress.currentStreak}</span>
              <span className="font-medium text-stone-400">{streakLabel(progress.currentStreak)}</span>
            </p>
          </div>
          <div
            className="mt-2 h-3 overflow-hidden rounded-full bg-white/10"
            role="meter"
            aria-label="Score streak"
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={Math.min(progress.currentStreak, 10)}
          >
            <div
              data-testid="streak-fill"
              className={`h-full rounded-full ${progress.currentStreak > 0 ? 'streak-fill' : ''}`}
              style={{ width: `${Math.min(progress.currentStreak, 10) * 10}%` }}
            />
          </div>
        </div>

        {summary ? (
          <div data-testid="round-summary" className="mt-8 text-center">
            <p className="text-sm font-semibold tracking-[0.28em] text-amber-200 uppercase">
              Round complete
            </p>
            <p data-testid="round-stars" className="mt-4 font-serif text-6xl text-amber-300">
              {summary.stars} stars
            </p>
            <p data-testid="clean-first" className="mt-4 text-xl text-stone-100">
              {summary.cleanOnFirstAppearance} on the first try
            </p>
            <p data-testid="clean-later" className="mt-1 text-xl text-stone-100">
              {summary.cleanAfterReturn} after practice
            </p>
            <p data-testid="set-aside" className="mt-1 text-xl text-stone-100">
              {summary.setAside} set aside
            </p>
            {progress.streakHistory.length > 0 ? (
              <ol className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm text-stone-400">
                {progress.streakHistory.slice(-3).map((history) => (
                  <li key={history.completedAt}>
                    {history.correct}/{history.total} correct · {history.stars} stars
                  </li>
                ))}
              </ol>
            ) : null}
            <button
              type="button"
              className={`${touchTarget} mt-8 w-full rounded-2xl bg-amber-400 px-6 text-lg font-semibold text-[#1c1406]`}
              onClick={backToChoices}
            >
              Back to study choices
            </button>
          </div>
        ) : queue?.current ? (
          <>
            {pageLesson ? (
              <div
                data-testid="page-progress"
                className="mt-4 grid grid-cols-2 gap-3"
                aria-label={`${shownClean} memorized, ${remaining} to go`}
              >
                <p className="rounded-2xl border border-green-400/25 bg-[#0e1210] px-3 py-3 text-center">
                  <span data-testid="memorized-count" className="block font-serif text-4xl text-green-400">
                    {shownClean}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-stone-300">memorized</span>
                </p>
                <p className="rounded-2xl border border-white/10 bg-[#0e1210] px-3 py-3 text-center">
                  <span data-testid="remaining-count" className="block font-serif text-4xl text-amber-200">
                    {remaining}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-stone-300">to go</span>
                </p>
              </div>
            ) : (
              <p
                data-testid="clean-count"
                className="mt-2 text-center text-sm text-stone-400"
                aria-label={`${shownClean} of ${queue.started.length} words clean`}
              >
                {shownClean} of {queue.started.length}
              </p>
            )}

            <form onSubmit={submitGuess} className="mt-8">
              <label htmlFor="spelling-guess" className="sr-only">
                Spelling guess
              </label>
              <div className="relative">
                <div
                  className="pointer-events-none flex min-h-16 flex-wrap items-center justify-center gap-1.5 sm:gap-2"
                  aria-label={`${slotCount(word)} characters`}
                >
                  {characters.map((character, slotIndex) => {
                    const typed = Array.from(draft)
                    const letter = typed[slotIndex] ?? ''
                    const isNext = !locked && slotIndex === typed.length
                    return (
                      <span
                        key={`${word}-${slotIndex}-${queue.appearances[word] ?? 0}`}
                        data-testid="letter-slot"
                        aria-hidden="true"
                        className={
                          character === ' ' && letter === ''
                            ? 'mx-1 h-11 w-2 sm:h-12'
                            : `flex h-11 w-7 items-center justify-center rounded-md border bg-[#0e1210] text-lg font-bold text-stone-50 shadow-inner sm:h-12 sm:w-9 ${
                                isNext
                                  ? 'border-amber-300 ring-2 ring-amber-300/70'
                                  : 'border-amber-100/25'
                              }`
                        }
                      >
                        {letter === ' ' ? '' : letter}
                      </span>
                    )
                  })}
                </div>
                <input
                  ref={guessRef}
                  id="spelling-guess"
                  name="guess"
                  value={draft}
                  disabled={locked}
                  maxLength={characters.length}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  style={{ fontSize: '18px' }}
                  className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
                  onChange={(event) => {
                    setDraft(Array.from(event.target.value).slice(0, characters.length).join(''))
                  }}
                />
              </div>
              {clueOpen && entry ? (
                <SentenceClue
                  definition={entry.definition}
                  sentence={maskSentence(entry.sentence, entry.word)}
                  onDismiss={() => setClueOpen(false)}
                />
              ) : null}
              <button
                type="submit"
                disabled={locked || draft.trim() === ''}
                className={`${touchTarget} mt-6 w-full rounded-2xl bg-white/10 px-5 text-base font-semibold text-stone-50 transition hover:bg-white/15 disabled:opacity-40`}
              >
                Submit
              </button>
            </form>

            <ol className="mt-6 flex flex-col items-center gap-2" aria-label="Spelling attempts">
              {attempts.map((attempt, attemptIndex) => (
                <li
                  key={`${word}-${attemptIndex}`}
                  data-testid="attempt-row"
                  className="flex max-w-full flex-wrap items-center justify-center gap-1.5 [perspective:700px] sm:gap-2"
                >
                  {Array.from(attempt.guess).map((character, tileIndex) => (
                    <span
                      key={`${attemptIndex}-${tileIndex}`}
                      data-testid="attempt-tile"
                      data-status={attempt.marks[tileIndex]}
                      style={{ animationDelay: `${tileIndex * 55}ms` }}
                      className={
                        character === ' '
                          ? `tile-flip mx-1 h-11 w-3 rounded-md border sm:h-12 ${markTone[attempt.marks[tileIndex] ?? 'absent']}`
                          : `tile-flip flex h-11 w-7 items-center justify-center rounded-md border text-lg font-bold sm:h-12 sm:w-9 ${markTone[attempt.marks[tileIndex] ?? 'absent']}`
                      }
                    >
                      {character === ' ' ? '' : character}
                    </span>
                  ))}
                </li>
              ))}
            </ol>

            {failed ? (
              <p data-testid="revealed-word" className="mt-5 text-center text-3xl font-bold text-green-400">
                {word}
              </p>
            ) : null}

            <p className="mt-3 text-center text-sm text-stone-400">
              {attempts.length} of {MAX_ATTEMPTS} attempts
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`${touchTarget} flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-3 text-center text-base font-semibold leading-tight text-[#1c1406] transition hover:bg-amber-300`}
                onClick={() => {
                  speakWord(word)
                  if (!locked) guessRef.current?.focus()
                }}
              >
                <Volume2 aria-hidden="true" />
                Hear Word
              </button>
              <button
                type="button"
                aria-expanded={clueOpen}
                className={`${touchTarget} flex items-center justify-center gap-2 rounded-2xl border border-amber-200/30 bg-amber-400/15 px-3 text-center text-base font-semibold leading-tight text-amber-100 transition hover:bg-amber-400/25`}
                onClick={showSentenceClue}
              >
                📖 In a Sentence
              </button>
            </div>

            <button
              type="button"
              disabled={!recorded}
              className={`${touchTarget} mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-stone-100 transition hover:bg-white/10 disabled:opacity-40`}
              onClick={showNextWord}
            >
              Next Word
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        ) : (
          !roomReady ? (
            <p className="mt-8 text-center text-lg text-stone-300">One moment</p>
          ) : family || joining ? (
            <FamilyMatch
              host={family && !joining}
              onBack={() => {
                hostRef.current = false
                setFamily(false)
              }}
            />
          ) : (
            <ChoiceScreen
              onStartRound={startDifficultyRound}
              onStartPage={(pageId) => openSession(startQueue(wordsForPage(pageId)), true)}
              onStartPick={(words) => openSession(startQueue(words), true)}
              onPlayFamily={() => {
                if (!familyMatchLivesHere()) {
                  location.assign(`${familyHomePageUrl()}/?family=1`)
                  return
                }
                stopSpeaking()
                hushSoundtrack()
                hostRef.current = true
                setJoining(false)
                setFamily(true)
              }}
            />
          )
        )}
      </section>
    </main>
  )
}

export default App
