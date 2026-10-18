import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { Flame, Star, Volume2, VolumeX } from 'lucide-react'
import { ALL_SPELLING_WORDS, SPELLING_ENTRIES, type BeeTier } from './data/words.ts'
import { STUDY_PAGES, wordsForPage, type StudyPageId } from './data/pages.ts'
import { DIFFICULTIES, wordsForDifficulty, type Difficulty, type RoundCount } from './study/difficulty.ts'
import { ChoiceScreen, SET_SIZE, setsOf } from './study/ChoiceScreen.tsx'
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
  dropTurn,
  finishTurn,
  isSessionComplete,
  sessionTally,
  startQueue,
  startRound,
  wordsToPractice,
  type StudyQueue,
} from './study/queue.ts'
import { clearSession, loadSession, saveSession, wordsLeft, type SavedSession, type SessionKind } from './study/savedSession.ts'
import { dayStreak, loadDays, recordWord, saveDays } from './study/daily.ts'
import { loadBook, noteWord, saveBook } from './study/learned.ts'
import { stopSpeaking } from './study/speech.ts'
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
import { StudyTurn } from './study/StudyTurn.tsx'
import { BeeTurn } from './study/BeeTurn.tsx'
import { touchTarget } from './study/TurnParts.tsx'

type SessionSummary = {
  stars: number
  cleanOnFirstAppearance: number
  cleanAfterReturn: number
  practicing: string[]
  complete: boolean
}

// The result of the turn on screen, held until she taps Next.
type FinishedTurn = { next: StudyQueue; stars: number }

const PRACTICE_SIZE = 10

function streakLabel(streak: number): string {
  if (streak >= 10) return 'On fire'
  if (streak >= 6) return 'Heating up'
  if (streak >= 3) return 'On a roll'
  if (streak >= 1) return 'Warming up'
  return 'Start a streak'
}

function pageLabel(pageId: StudyPageId): string {
  return STUDY_PAGES.find((page) => page.id === pageId)?.label ?? 'Page'
}

function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [book, setBook] = useState(loadBook)
  const [days, setDays] = useState(loadDays)
  const [session, setSession] = useState<SavedSession | null>(null)
  const [turn, setTurn] = useState<FinishedTurn | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [resume, setResume] = useState<SavedSession | null>(loadSession)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [music, setMusic] = useState(readMusicPreference)
  const [family, setFamily] = useState(false)
  const [joining, setJoining] = useState(false)
  const [roomReady, setRoomReady] = useState(import.meta.env.MODE === 'test')
  const hostRef = useRef(false)
  const soloRef = useRef(false)
  const sessionRef = useRef<SavedSession | null>(null)

  sessionRef.current = session

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
      if (hostRef.current || soloRef.current || sessionRef.current) return
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

  useEffect(() => {
    startTune()
  }, [])

  useEffect(() => {
    if (!summary?.complete) return
    playEffect('complete')
    playLine('finished')
  }, [summary])

  const queue = turn?.next ?? session?.queue ?? null
  const word = session?.queue.current ?? ''
  const shownClean = queue ? cleanCount(queue) : 0
  const listLesson = session !== null && session.kind !== 'round' && session.kind !== 'bee'
  const remaining = queue ? queue.started.length - shownClean : 0
  const streakDays = dayStreak(days)

  function openSession(kind: SessionKind, label: string, nextQueue: StudyQueue, stars = 0) {
    if (nextQueue.current === null) return
    stopSpeaking()
    stopLine()
    const next = { kind, label, queue: nextQueue, stars }
    saveSession(next)
    setSession(next)
    setTurn(null)
    setSummary(null)
    setConfirmQuit(false)
  }

  function startDifficultyRound(difficulty: Difficulty, count: RoundCount) {
    const label = DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? 'Quiz'
    openSession('round', `${label} quiz`, startRound(wordsForDifficulty(ALL_SPELLING_WORDS, difficulty), count))
  }

  function startPage(pageId: StudyPageId, set?: number) {
    const words = wordsForPage(pageId)
    if (set === undefined) {
      openSession('page', pageLabel(pageId), startQueue(words))
      return
    }
    const first = set * SET_SIZE + 1
    const chosen = setsOf(words)[set] ?? []
    openSession('page', `${pageLabel(pageId)} · Words ${first}–${first + chosen.length - 1}`, startQueue(chosen))
  }

  function startBee(tier: BeeTier, count: RoundCount) {
    const words = SPELLING_ENTRIES.filter((entry) => entry.tier === tier).map((entry) => entry.word)
    openSession('bee', `${tier} bee`, startRound(words, count))
  }

  function startPractice(words: readonly string[]) {
    openSession('practice', 'My practice words', startQueue(words.slice(0, PRACTICE_SIZE)))
  }

  function turnDone(attemptsUsed: number, solved: boolean) {
    if (!session) return
    const clean = solved && attemptsUsed === 1
    const nextProgress = recordTurn(progress, attemptsUsed, solved)
    saveProgress(nextProgress)
    setProgress(nextProgress)
    const nextBook = noteWord(book, word, clean)
    saveBook(nextBook)
    setBook(nextBook)
    const nextDays = recordWord(days)
    saveDays(nextDays)
    setDays(nextDays)

    const next =
      session.kind === 'bee'
        ? solved
          ? finishTurn(session.queue, true)
          : dropTurn(session.queue)
        : finishTurn(session.queue, clean)
    const stars = session.stars + starsFor(attemptsUsed, solved)
    if (isSessionComplete(next)) clearSession()
    else saveSession({ ...session, queue: next, stars })
    setTurn({ next, stars })
  }

  function endSession(finished: StudyQueue, stars: number) {
    const complete = isSessionComplete(finished)
    const tally = sessionTally(finished)
    const nextProgress = appendRoundHistory(progress, {
      stars,
      correct: tally.cleanOnFirstAppearance + tally.cleanAfterReturn,
      total: complete ? tally.started : tally.cleanOnFirstAppearance + tally.cleanAfterReturn + wordsToPractice(finished).length,
    })
    saveProgress(nextProgress)
    setProgress(nextProgress)
    setSummary({
      stars,
      cleanOnFirstAppearance: tally.cleanOnFirstAppearance,
      cleanAfterReturn: tally.cleanAfterReturn,
      practicing: wordsToPractice(finished),
      complete,
    })
    setSession(null)
    setTurn(null)
    setConfirmQuit(false)
    if (complete) {
      void confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.65 },
        colors: ['#fbbf24', '#4ade80', '#fde68a'],
      })
    }
  }

  function showNextWord() {
    if (!session || !turn) return
    stopSpeaking()
    if (isSessionComplete(turn.next)) {
      endSession(turn.next, turn.stars)
      return
    }
    setSession({ ...session, queue: turn.next, stars: turn.stars })
    setTurn(null)
  }

  function quitForNow() {
    if (!session) return
    stopSpeaking()
    // The saved session already holds every finished word, so it resumes here.
    endSession(turn?.next ?? session.queue, turn?.stars ?? session.stars)
  }

  function backToChoices() {
    stopSpeaking()
    confetti.reset?.()
    setSession(null)
    setTurn(null)
    setSummary(null)
    setResume(loadSession())
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0e1210] px-4 py-6 text-stone-100">
      <section className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[#171d1a] px-4 py-6 shadow-2xl sm:px-10 sm:py-10">
        {session ? null : (
          <>
            <p className="text-center text-xs font-semibold tracking-[0.32em] text-amber-200/80 uppercase">
              Study
            </p>
            <h1 className="mt-3 text-center font-serif text-4xl text-stone-50 sm:text-5xl">
              Spelling Bee
            </h1>
          </>
        )}
        <div className={`${session ? '' : 'mt-5'} rounded-2xl border border-white/10 bg-[#0e1210] px-4 py-2`}>
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
            <p className="flex items-center gap-2 text-orange-300" aria-label={`${streakDays} days in a row`}>
              <Flame aria-hidden="true" size={18} className={streakDays > 0 ? 'fill-orange-400' : ''} />
              <span data-testid="day-streak">{streakDays}</span>
              <span className="font-medium text-stone-400">{streakDays === 1 ? 'day' : 'days'}</span>
            </p>
          </div>
          {session ? (
            <div className="mt-1 flex items-center gap-3 pb-1">
              <span className="text-xs font-semibold whitespace-nowrap text-stone-400">
                <span data-testid="current-streak">{progress.currentStreak}</span> · {streakLabel(progress.currentStreak)}
              </span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"
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
          ) : null}
        </div>

        {summary ? (
          <div data-testid="round-summary" className="mt-8 text-center">
            <p className="text-sm font-semibold tracking-[0.28em] text-amber-200 uppercase">
              {summary.complete ? 'Round complete' : 'Nice work for now'}
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
              {summary.practicing.length} still practicing
            </p>
            {summary.practicing.length > 0 ? (
              <ul className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2" aria-label="Words still practicing">
                {summary.practicing.map((item) => (
                  <li key={item} className="rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-base text-amber-100">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            {summary.complete ? null : (
              <p className="mt-4 text-base text-stone-300">Your spot is saved. Pick “Keep going” next time.</p>
            )}
            {summary.practicing.length > 0 ? (
              <button
                type="button"
                className={`${touchTarget} mt-8 w-full rounded-2xl border border-amber-300/40 bg-amber-400/15 px-6 text-lg font-semibold text-amber-100`}
                onClick={() => startPractice(summary.practicing)}
              >
                Practice these now
              </button>
            ) : null}
            <button
              type="button"
              className={`${touchTarget} mt-3 w-full rounded-2xl bg-amber-400 px-6 text-lg font-semibold text-[#1c1406]`}
              onClick={backToChoices}
            >
              Back to study choices
            </button>
          </div>
        ) : session && word ? (
          <>
            <p className="mt-4 text-center text-sm font-semibold text-stone-300">{session.label}</p>
            {listLesson ? (
              <div
                data-testid="page-progress"
                className="mt-3 grid grid-cols-2 gap-3"
                aria-label={`${shownClean} memorized, ${remaining} to go`}
              >
                <p className="rounded-2xl border border-green-400/25 bg-[#0e1210] px-3 py-2 text-center">
                  <span data-testid="memorized-count" className="block font-serif text-3xl text-green-400">
                    {shownClean}
                  </span>
                  <span className="block text-sm font-semibold text-stone-300">memorized</span>
                </p>
                <p className="rounded-2xl border border-white/10 bg-[#0e1210] px-3 py-2 text-center">
                  <span data-testid="remaining-count" className="block font-serif text-3xl text-amber-200">
                    {remaining}
                  </span>
                  <span className="block text-sm font-semibold text-stone-300">to go</span>
                </p>
              </div>
            ) : session.kind === 'bee' ? (
              <p data-testid="bee-count" className="mt-1 text-center text-sm text-stone-400">
                Word {session.queue.started.length - wordsLeft(session.queue) + 1} of {session.queue.started.length}
              </p>
            ) : (
              <p
                data-testid="clean-count"
                className="mt-1 text-center text-sm text-stone-400"
                aria-label={`${shownClean} of ${session.queue.started.length} words clean`}
              >
                {shownClean} of {session.queue.started.length}
              </p>
            )}

            {session.kind === 'bee' ? (
              <BeeTurn
                key={`${word}-${session.queue.appearances[word] ?? 0}`}
                word={word}
                onDone={(solved) => turnDone(1, solved)}
                onNext={showNextWord}
              />
            ) : (
              <StudyTurn
                key={`${word}-${session.queue.appearances[word] ?? 0}`}
                word={word}
                onDone={turnDone}
                onNext={showNextWord}
              />
            )}

            {confirmQuit ? (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`${touchTarget} rounded-2xl bg-white/10 px-3 text-base font-semibold text-stone-100`}
                  onClick={quitForNow}
                >
                  Yes, stop here
                </button>
                <button
                  type="button"
                  className={`${touchTarget} rounded-2xl border border-white/10 px-3 text-base font-semibold text-stone-300`}
                  onClick={() => setConfirmQuit(false)}
                >
                  Keep spelling
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${touchTarget} mt-6 w-full rounded-2xl border border-white/10 px-4 text-sm font-medium text-stone-400`}
                onClick={() => setConfirmQuit(true)}
              >
                I'm done for now
              </button>
            )}
          </>
        ) : (
          !roomReady ? (
            <p className="mt-8 text-center text-lg text-stone-300">One moment</p>
          ) : family || joining ? (
            <FamilyMatch
              host={family && !joining}
              onBack={() => {
                hostRef.current = false
                soloRef.current = true
                setFamily(false)
                setJoining(false)
              }}
            />
          ) : (
            <ChoiceScreen
              onStartRound={startDifficultyRound}
              onStartPage={startPage}
              onStartPick={(words) => openSession('pick', 'Your picked words', startQueue(words))}
              onStartBee={startBee}
              resume={resume ? { label: resume.label, left: wordsLeft(resume.queue) } : null}
              onResume={() => {
                if (resume) openSession(resume.kind, resume.label, resume.queue, resume.stars)
              }}
              book={book}
              onPractice={() => startPractice(book.practice)}
              onPlayFamily={() => {
                if (!familyMatchLivesHere()) {
                  location.assign(`${familyHomePageUrl()}/?family=1`)
                  return
                }
                stopSpeaking()
                hushSoundtrack()
                hostRef.current = true
                soloRef.current = false
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
