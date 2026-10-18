import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Timer, Volume2 } from 'lucide-react'
import { factsForWord } from '../data/wordFacts.ts'
import { entryForWord } from '../data/words.ts'
import { isSolvedGuess } from './evaluateGuess.ts'
import { maskSentence } from './sentenceClue.ts'
import { playEffect, playLine } from './soundtrack.ts'
import { speakWord, stopSpeaking } from './speech.ts'
import { SPEAK_DELAY_MS } from './StudyTurn.tsx'
import { NextButton, SpellingComparison, touchTarget } from './TurnParts.tsx'

export const BEE_SECONDS = 60

type Ask = 'definition' | 'sentence' | 'partOfSpeech' | 'origin'

const ASKS: { id: Ask; label: string }[] = [
  { id: 'definition', label: 'Definition' },
  { id: 'sentence', label: 'Sentence' },
  { id: 'partOfSpeech', label: 'Part of speech' },
  { id: 'origin', label: 'Origin' },
]

// One try, no length hint, letters can't be taken back, and a clock: the
// way the word is spelled on stage.
export function BeeTurn({
  word,
  onDone,
  onNext,
}: {
  word: string
  onDone: (solved: boolean) => void
  onNext: () => void
}) {
  const [draft, setDraft] = useState('')
  const [result, setResult] = useState<{ guess: string; solved: boolean } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(BEE_SECONDS)
  const [asked, setAsked] = useState<Ask[]>([])
  const guessRef = useRef<HTMLInputElement>(null)
  const entry = entryForWord(word)
  const facts = factsForWord(word)

  const answers: Record<Ask, string> = {
    definition: entry?.definition ?? '',
    sentence: entry ? maskSentence(entry.sentence, entry.word) : '',
    partOfSpeech: facts?.partOfSpeech ?? '',
    origin: facts?.origin ?? '',
  }

  useEffect(() => {
    const timer = window.setTimeout(() => speakWord(word), SPEAK_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      stopSpeaking()
    }
  }, [word])

  useEffect(() => {
    if (result) return
    const tick = window.setInterval(() => setSecondsLeft((left) => Math.max(0, left - 1)), 1000)
    return () => window.clearInterval(tick)
  }, [result])

  function finish(guess: string) {
    if (result) return
    const solved = guess.trim() !== '' && isSolvedGuess(guess.trim(), word)
    setResult({ guess: guess.trim(), solved })
    if (solved) {
      playEffect('correct')
      playLine('yes')
    } else {
      playEffect('miss')
      speakWord(word)
    }
    onDone(solved)
  }

  useEffect(() => {
    if (secondsLeft === 0 && !result) finish(draft)
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draft.trim() !== '') finish(draft)
  }

  return (
    <div data-testid="bee-turn">
      <div className="mt-6 flex items-center justify-center gap-2 text-lg font-semibold" aria-live="off">
        <Timer aria-hidden="true" className={secondsLeft <= 10 ? 'text-rose-400' : 'text-amber-300'} />
        <span data-testid="bee-clock" className={secondsLeft <= 10 ? 'text-rose-300' : 'text-stone-100'}>
          0:{String(secondsLeft).padStart(2, '0')}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${secondsLeft <= 10 ? 'bg-rose-400' : 'bg-amber-300'}`}
          style={{ width: `${(secondsLeft / BEE_SECONDS) * 100}%` }}
        />
      </div>

      {result ? (
        result.solved ? (
          <p data-testid="bee-correct" className="mt-6 text-center font-serif text-4xl text-green-400">
            {word} ✓
          </p>
        ) : (
          <SpellingComparison guess={result.guess} word={word} />
        )
      ) : (
        <form onSubmit={submit} className="mt-6">
          <label htmlFor="bee-guess" className="block text-center text-sm text-stone-400">
            Spell it. Letters can't be taken back.
          </label>
          <input
            id="bee-guess"
            ref={guessRef}
            value={draft}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            className="mt-2 w-full rounded-2xl border border-amber-200/40 bg-[#0e1210] px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.2em] text-stone-50 outline-none focus:border-amber-300"
            onKeyDown={(event) => {
              if (event.key === 'Backspace' || event.key === 'Delete') event.preventDefault()
            }}
            onChange={(event) => {
              const next = event.target.value
              // ponytail: only appends are accepted, so no letter can be changed once typed.
              if (next.startsWith(draft)) setDraft(next)
            }}
          />
          <button
            type="submit"
            disabled={draft.trim() === ''}
            className={`${touchTarget} mt-4 w-full rounded-2xl bg-white/10 px-5 text-lg font-semibold text-stone-50 disabled:opacity-40`}
          >
            Done spelling
          </button>
        </form>
      )}

      <button
        type="button"
        className={`${touchTarget} mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-3 text-base font-semibold text-[#1c1406]`}
        onClick={() => {
          speakWord(word)
          guessRef.current?.focus()
        }}
      >
        <Volume2 aria-hidden="true" />
        Say it again
      </button>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {ASKS.map((ask) => (
          <button
            key={ask.id}
            type="button"
            aria-pressed={asked.includes(ask.id)}
            className={`${touchTarget} rounded-2xl border border-amber-200/30 bg-amber-400/15 px-2 text-base font-semibold text-amber-100`}
            onClick={() => {
              setAsked((current) => (current.includes(ask.id) ? current : [...current, ask.id]))
              guessRef.current?.focus()
            }}
          >
            {ask.label}
          </button>
        ))}
      </div>
      {asked.length > 0 ? (
        <dl data-testid="bee-answers" className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-[#0e1210] px-4 py-4">
          {asked.map((ask) => (
            <div key={ask}>
              <dt className="text-xs font-semibold tracking-[0.16em] text-stone-400 uppercase">
                {ASKS.find((item) => item.id === ask)?.label}
              </dt>
              <dd data-testid={`bee-${ask}`} className="mt-1 text-lg text-stone-100">
                {answers[ask]}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {result ? <NextButton onNext={onNext} /> : null}
    </div>
  )
}
