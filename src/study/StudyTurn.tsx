import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Volume2 } from 'lucide-react'
import { entryForWord } from '../data/words.ts'
import { evaluateGuess, isSolvedGuess, MAX_ATTEMPTS, type LetterMark } from './evaluateGuess.ts'
import { maskSentence } from './sentenceClue.ts'
import { playEffect, playLine } from './soundtrack.ts'
import { speakWord, stopSpeaking } from './speech.ts'
import { NextButton, SentenceClue, SpellingComparison, touchTarget } from './TurnParts.tsx'

type Attempt = { guess: string; marks: LetterMark[] }

export const SPEAK_DELAY_MS = 350

const markTone: Record<LetterMark, string> = {
  correct: 'border-green-300 bg-green-500 text-white',
  present: 'border-yellow-200 bg-yellow-400 text-stone-950',
  absent: 'border-slate-500 bg-slate-600 text-slate-100',
}

// Hyphens are filled in for her, the way spaces already show as gaps.
export function fillHyphens(value: string, word: string): string {
  const typed = Array.from(value)
  const target = Array.from(word)
  while (typed.length < target.length && target[typed.length] === '-') typed.push('-')
  return typed.join('')
}

function tileSize(length: number): string {
  return length > 10
    ? 'h-10 w-[1.35rem] text-base sm:h-12 sm:w-8 sm:text-lg'
    : 'h-11 w-7 text-lg sm:h-12 sm:w-9'
}

// One turn of a lesson or round. Keyed by the parent per turn, so all state
// here starts fresh with each word.
export function StudyTurn({
  word,
  onDone,
  onNext,
  maxAttempts = MAX_ATTEMPTS,
}: {
  word: string
  onDone: (attemptsUsed: number, solved: boolean) => void
  onNext: () => void
  maxAttempts?: number
}) {
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [draft, setDraft] = useState('')
  const [clueOpen, setClueOpen] = useState(false)
  const guessRef = useRef<HTMLInputElement>(null)
  const characters = Array.from(word)
  const solved = attempts.some((attempt) => isSolvedGuess(attempt.guess, word))
  const failed = !solved && attempts.length >= maxAttempts
  const locked = solved || failed
  const entry = entryForWord(word)
  const size = tileSize(characters.length)

  useEffect(() => {
    const timer = window.setTimeout(() => speakWord(word), SPEAK_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      stopSpeaking()
    }
  }, [word])

  useEffect(() => {
    if (!solved) return
    const timer = window.setTimeout(onNext, 1500)
    return () => window.clearTimeout(timer)
  }, [solved, onNext])

  function submitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const guess = draft.trim()
    if (!guess || locked) return

    const nextAttempts = [...attempts, { guess, marks: evaluateGuess(guess, word) }]
    const nowSolved = isSolvedGuess(guess, word)
    setAttempts(nextAttempts)
    setDraft('')
    // Tapping Submit takes focus off the box; put it back so the keyboard stays up.
    if (!nowSolved && nextAttempts.length < maxAttempts) guessRef.current?.focus()

    if (nowSolved) {
      playEffect('correct')
      playLine('yes')
    } else if (nextAttempts.length >= maxAttempts) {
      playEffect('miss')
      speakWord(word)
    } else {
      playLine('tryAgain')
    }
    if (nowSolved || nextAttempts.length >= maxAttempts) onDone(nextAttempts.length, nowSolved)
  }

  const lastGuess = attempts.at(-1)?.guess ?? ''

  return (
    <>
      <ol className="mt-6 flex flex-col items-center gap-2" aria-label="Spelling attempts">
        {attempts.map((attempt, attemptIndex) => (
          <li
            key={attemptIndex}
            data-testid="attempt-row"
            className="flex max-w-full flex-wrap items-center justify-center gap-1 [perspective:700px] sm:gap-2"
          >
            {Array.from(attempt.guess).map((character, tileIndex) => (
              <span
                key={tileIndex}
                data-testid="attempt-tile"
                data-status={attempt.marks[tileIndex]}
                style={{ animationDelay: `${tileIndex * 55}ms` }}
                className={
                  character === ' '
                    ? `tile-flip mx-1 h-11 w-3 rounded-md border sm:h-12 ${markTone[attempt.marks[tileIndex] ?? 'absent']}`
                    : `tile-flip flex items-center justify-center rounded-md border font-bold ${size} ${markTone[attempt.marks[tileIndex] ?? 'absent']}`
                }
              >
                {character === ' ' ? '' : character}
              </span>
            ))}
          </li>
        ))}
      </ol>

      {locked ? null : (
        <form onSubmit={submitGuess} className="mt-6">
          <label htmlFor="spelling-guess" className="sr-only">
            Spelling guess
          </label>
          <div className="relative">
            <div
              className="pointer-events-none flex min-h-16 flex-wrap items-center justify-center gap-1 sm:gap-2"
              aria-label={`${characters.length} characters`}
            >
              {characters.map((character, slotIndex) => {
                const typed = Array.from(draft)
                const letter = typed[slotIndex] ?? ''
                const isNext = slotIndex === typed.length
                return (
                  <span
                    key={slotIndex}
                    data-testid="letter-slot"
                    aria-hidden="true"
                    className={
                      character === ' ' && (letter === '' || letter === ' ')
                        ? 'mx-1 h-11 w-2 sm:h-12'
                        : `flex items-center justify-center rounded-md border bg-[#0e1210] font-bold text-stone-50 shadow-inner ${size} ${
                            isNext ? 'border-amber-300 ring-2 ring-amber-300/70' : 'border-amber-100/25'
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
              autoFocus
              maxLength={characters.length}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              style={{ fontSize: '18px' }}
              className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
              onChange={(event) => {
                const next = Array.from(event.target.value).slice(0, characters.length).join('')
                setDraft(next.length > draft.length ? fillHyphens(next, word) : next)
              }}
            />
          </div>
          <button
            type="submit"
            disabled={draft.trim() === ''}
            className={`${touchTarget} mt-5 w-full rounded-2xl bg-white/10 px-5 text-base font-semibold text-stone-50 transition hover:bg-white/15 disabled:opacity-40`}
          >
            Submit
          </button>
        </form>
      )}

      {failed ? <SpellingComparison guess={lastGuess} word={word} /> : null}

      {clueOpen && entry ? (
        <SentenceClue
          definition={entry.definition}
          sentence={maskSentence(entry.sentence, entry.word)}
          onDismiss={() => {
            setClueOpen(false)
            if (!locked) guessRef.current?.focus()
          }}
        />
      ) : null}

      <p className="mt-3 text-center text-sm text-stone-400">
        {attempts.length} of {maxAttempts} {maxAttempts === 1 ? 'try' : 'attempts'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          className={`${touchTarget} flex items-center justify-center gap-2 rounded-2xl ${
            locked ? 'border border-amber-200/30 bg-amber-400/15 text-amber-100' : 'bg-amber-400 text-[#1c1406] hover:bg-amber-300'
          } px-3 text-center text-base font-semibold leading-tight transition`}
          onClick={() => {
            speakWord(word)
            if (!locked) guessRef.current?.focus()
          }}
        >
          <Volume2 aria-hidden="true" />
          Hear it again
        </button>
        <button
          type="button"
          aria-expanded={clueOpen}
          className={`${touchTarget} flex items-center justify-center gap-2 rounded-2xl border border-amber-200/30 bg-amber-400/15 px-3 text-center text-base font-semibold leading-tight text-amber-100 transition hover:bg-amber-400/25`}
          onClick={() => {
            if (!entry) return
            setClueOpen(true)
            if (!locked) guessRef.current?.focus()
          }}
        >
          📖 In a Sentence
        </button>
      </div>

      {locked ? <NextButton onNext={onNext} autoAdvance={solved} /> : null}
    </>
  )
}
