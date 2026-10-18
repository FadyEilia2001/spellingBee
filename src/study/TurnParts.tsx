import { useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { compareSpelling, type ComparedLetter } from './compareSpelling.ts'

export const touchTarget =
  'min-h-[52px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200'

export function SentenceClue({
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
      <p className="mt-3 text-xs font-semibold tracking-[0.16em] text-stone-400 uppercase">Meaning</p>
      <p data-testid="clue-definition" className="mt-1 text-base leading-relaxed text-stone-100">
        {definition}
      </p>
      <p className="mt-3 text-xs font-semibold tracking-[0.16em] text-stone-400 uppercase">Sentence</p>
      <p data-testid="clue-sentence" className="mt-1 text-lg leading-relaxed text-amber-100">
        {sentence}
      </p>
    </aside>
  )
}

function Letters({ letters, wrong }: { letters: ComparedLetter[]; wrong: string }) {
  return (
    <span className="font-mono text-2xl font-bold tracking-wide sm:text-3xl">
      {letters.map((letter, index) => (
        <span key={index} className={letter.ok ? '' : `${wrong} rounded underline decoration-2 underline-offset-4`}>
          {letter.character}
        </span>
      ))}
    </span>
  )
}

// "You wrote / It's spelled": her try lined up against the word, with the
// letters she added in red and the ones she left out in green.
export function SpellingComparison({ guess, word }: { guess: string; word: string }) {
  const { wrote, spelled } = compareSpelling(guess, word)
  return (
    <div data-testid="spelling-comparison" className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-[#0e1210] px-4 py-4 text-center">
      <p className="text-xs font-semibold tracking-[0.16em] text-stone-400 uppercase">You wrote</p>
      <p data-testid="you-wrote" className="text-stone-200">
        <Letters letters={wrote} wrong="bg-rose-500/25 text-rose-300" />
      </p>
      <p className="mt-2 text-xs font-semibold tracking-[0.16em] text-stone-400 uppercase">It's spelled</p>
      <p data-testid="revealed-word" className="text-green-400">
        <Letters letters={spelled} wrong="bg-green-400/20 text-green-300" />
      </p>
    </div>
  )
}

export function NextButton({ onNext }: { onNext: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // Focused so Enter moves on once the keyboard has closed.
    ref.current?.focus()
  }, [])
  return (
    <button
      ref={ref}
      type="button"
      className={`${touchTarget} mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 text-xl font-semibold text-[#1c1406] transition hover:bg-amber-300`}
      onClick={onNext}
    >
      Next Word
      <ChevronRight aria-hidden="true" />
    </button>
  )
}
