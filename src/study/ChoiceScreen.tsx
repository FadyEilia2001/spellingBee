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

const prompt = 'text-center text-xl font-semibold leading-snug text-stone-50'
const choiceButton = `${touchTarget} w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-lg font-semibold text-stone-100`

type Step = 'adventure' | 'page' | 'difficulty' | 'count'

export function ChoiceScreen({
  onStartRound,
  onStartPage,
}: {
  onStartRound: (difficulty: Difficulty, count: RoundCount) => void
  onStartPage: (pageId: StudyPageId) => void
}) {
  const [step, setStep] = useState<Step>('adventure')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)

  return (
    <div className="mt-8">
      {step === 'adventure' ? (
        <>
          <p className={prompt}>Hi Ella, choose your adventure</p>
          <div className="mt-4 grid gap-3">
            <button type="button" className={choiceButton} onClick={() => setStep('page')}>
              Study a page
            </button>
            <button type="button" className={choiceButton} onClick={() => setStep('difficulty')}>
              Quiz
            </button>
          </div>
        </>
      ) : null}

      {step === 'page' ? (
        <>
          <p className={prompt}>Please select which page you want to study.</p>
          <div className="mt-4 grid gap-3">
            {STUDY_PAGES.map((page) => (
              <button
                key={page.id}
                type="button"
                className={choiceButton}
                onClick={() => onStartPage(page.id)}
              >
                {page.label}
              </button>
            ))}
          </div>
          <Back onClick={() => setStep('adventure')} />
        </>
      ) : null}

      {step === 'difficulty' ? (
        <>
          <p className={prompt}>Please select the difficulty.</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {DIFFICULTIES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                className={`${touchTarget} rounded-2xl border border-white/10 bg-white/5 px-2 text-base font-semibold text-stone-100`}
                onClick={() => {
                  setDifficulty(item.id)
                  setStep('count')
                }}
              >
                {item.label}
                <span className="mt-1 block text-xs font-medium opacity-80">{item.detail}</span>
              </button>
            ))}
          </div>
          <Back onClick={() => setStep('adventure')} />
        </>
      ) : null}

      {step === 'count' && difficulty !== null ? (
        <>
          <p className={prompt}>Please select how many words.</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {ROUND_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                className={`${touchTarget} rounded-2xl border border-white/10 bg-white/5 px-2 text-base font-semibold text-stone-100`}
                onClick={() => onStartRound(difficulty, count)}
              >
                {count} words
              </button>
            ))}
          </div>
          <Back onClick={() => setStep('difficulty')} />
        </>
      ) : null}
    </div>
  )
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${touchTarget} mt-6 w-full rounded-2xl border border-white/10 px-4 text-base font-semibold text-stone-300`}
      onClick={onClick}
    >
      Back
    </button>
  )
}
