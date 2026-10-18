import { useState } from 'react'
import type { StudyPageId } from '../data/pages.ts'
import { STUDY_PAGES } from '../data/pages.ts'
import {
  DIFFICULTIES,
  ROUND_COUNTS,
  type Difficulty,
  type RoundCount,
} from './difficulty.ts'

const touchTarget =
  'min-h-[52px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200'

export function ChoiceScreen({
  onStartRound,
  onStartPage,
}: {
  onStartRound: (difficulty: Difficulty, count: RoundCount) => void
  onStartPage: (pageId: StudyPageId) => void
}) {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [count, setCount] = useState<RoundCount | null>(null)

  return (
    <div className="mt-8">
      <p className="text-center text-sm font-semibold tracking-[0.18em] text-stone-400 uppercase">
        Practice a round
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {DIFFICULTIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={difficulty === item.id}
            aria-label={item.label}
            className={`${touchTarget} rounded-2xl border px-2 text-base font-semibold ${
              difficulty === item.id
                ? 'border-amber-300 bg-amber-400 text-[#1c1406]'
                : 'border-white/10 bg-white/5 text-stone-100'
            }`}
            onClick={() => setDifficulty(item.id)}
          >
            {item.label}
            <span className="mt-1 block text-xs font-medium opacity-80">{item.detail}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {ROUND_COUNTS.map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={count === choice}
            aria-label={`${choice} words`}
            className={`${touchTarget} rounded-2xl border px-2 text-base font-semibold ${
              count === choice
                ? 'border-amber-300 bg-amber-400 text-[#1c1406]'
                : 'border-white/10 bg-white/5 text-stone-100'
            }`}
            onClick={() => setCount(choice)}
          >
            {choice} words
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={difficulty === null || count === null}
        className={`${touchTarget} mt-3 w-full rounded-2xl bg-amber-400 px-6 text-lg font-semibold text-[#1c1406] disabled:opacity-40`}
        onClick={() => {
          if (difficulty === null || count === null) return
          onStartRound(difficulty, count)
        }}
      >
        Start round
      </button>

      <p className="mt-8 text-center text-sm font-semibold tracking-[0.18em] text-stone-400 uppercase">
        Study a page
      </p>
      <div className="mt-3 grid gap-3">
        {STUDY_PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            aria-label={page.label}
            className={`${touchTarget} rounded-2xl border border-white/10 bg-white/5 px-4 text-base font-semibold text-stone-100`}
            onClick={() => onStartPage(page.id)}
          >
            {page.label}
          </button>
        ))}
      </div>
    </div>
  )
}
