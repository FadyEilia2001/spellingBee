import { useEffect, useState } from 'react'
import { STUDY_PAGES, wordsForPage, type StudyPageId } from '../data/pages.ts'
import { SPELLING_ENTRIES, type BeeTier } from '../data/words.ts'
import {
  DIFFICULTIES,
  ROUND_COUNTS,
  type Difficulty,
  type RoundCount,
} from './difficulty.ts'
import type { WordBook } from './learned.ts'
import { pageStatus, SET_SIZE, setsOf, type PageTests } from './pagePlan.ts'
import { PageProgress } from './PageProgress.tsx'
import { type LineId } from './lines.ts'
import { playLine, playTick, stopLine } from './soundtrack.ts'
import { WordPick } from './WordPick.tsx'

const touchTarget =
  'min-h-[52px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200'

const prompt = 'text-center text-xl font-semibold leading-snug text-stone-50'
const choiceButton = `${touchTarget} w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-lg font-semibold text-stone-100`

type Step = 'adventure' | 'page' | 'scope' | 'pick' | 'difficulty' | 'count' | 'beeTier' | 'beeCount'

const LINE_FOR_STEP: Record<Exclude<Step, 'scope' | 'pick'>, LineId> = {
  adventure: 'adventure',
  page: 'page',
  difficulty: 'difficulty',
  count: 'count',
  beeTier: 'bee',
  beeCount: 'count',
}

const BEE_TIERS: BeeTier[] = ['One Bee', 'Two Bee', 'Three Bee']

export type ResumeOffer = { label: string; left: number }

export function ChoiceScreen({
  onStartRound,
  onStartPage,
  onStartPick,
  onStartBee = () => {},
  onPlayFamily,
  resume = null,
  onResume = () => {},
  book = { learned: [], practice: [] },
  onPractice = () => {},
  tests = {},
  today = null,
  todayNext = '',
  onToday = () => {},
  onStartPageTest = () => {},
}: {
  onStartRound: (difficulty: Difficulty, count: RoundCount) => void
  onStartPage: (pageId: StudyPageId, set?: number) => void
  onStartPick: (words: string[]) => void
  onStartBee?: (tier: BeeTier, count: RoundCount) => void
  onPlayFamily: () => void
  resume?: ResumeOffer | null
  onResume?: () => void
  book?: WordBook
  onPractice?: () => void
  tests?: PageTests
  today?: StudyPageId | null
  todayNext?: string
  onToday?: () => void
  onStartPageTest?: (pageId: StudyPageId) => void
}) {
  const [step, setStep] = useState<Step>('adventure')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [tier, setTier] = useState<BeeTier | null>(null)
  const [pageId, setPageId] = useState<StudyPageId>(STUDY_PAGES[0].id)
  const learned = new Set(book.learned)
  const todayStatus = today ? pageStatus(today, book, tests) : null
  const scopeStatus = pageStatus(pageId, book, tests)

  useEffect(() => {
    if (step === 'scope' || step === 'pick') {
      stopLine()
      return
    }
    if (step === 'count' && difficulty === null) return
    if (step === 'beeCount' && tier === null) return
    playLine(LINE_FOR_STEP[step])
    return () => stopLine()
  }, [step, difficulty, tier])

  return (
    <div className="mt-8">
      {step === 'adventure' ? (
        <>
          <p className={prompt}>Hi Ella, choose your adventure.</p>
          <p className={`${prompt} mt-2`}>You can study a page or embark on a quiz.</p>
          <div className="mt-4 grid gap-3">
            {todayStatus ? (
              <button
                type="button"
                data-testid="today-button"
                className={`${touchTarget} w-full rounded-2xl bg-amber-400 px-4 py-3 text-left text-xl font-semibold text-[#1c1406]`}
                onClick={onToday}
              >
                Today: {STUDY_PAGES.find((page) => page.id === today)?.label}
                <span className="block text-base font-medium">{todayNext}</span>
                <PageProgress status={todayStatus} tone="light" />
              </button>
            ) : (
              <p className="rounded-2xl border border-green-400/40 bg-green-500/10 px-4 py-3 text-center text-lg font-semibold text-green-200">
                🎉 All six pages are done!
              </p>
            )}
            {resume ? (
              <button
                type="button"
                className={`${touchTarget} w-full rounded-2xl border border-amber-300/40 bg-amber-400/15 px-4 py-2 text-lg font-semibold text-amber-100`}
                onClick={onResume}
              >
                Keep going: {resume.label}
                <span className="block text-sm font-medium">{resume.left} {resume.left === 1 ? 'word' : 'words'} left</span>
              </button>
            ) : null}
            <button type="button" className={choiceButton} onClick={() => setStep('page')}>
              Study a page
            </button>
            <button type="button" className={choiceButton} onClick={() => setStep('difficulty')}>
              Quiz
            </button>
            <button type="button" className={`${choiceButton} border-amber-300/40 text-amber-100`} onClick={() => setStep('beeTier')}>
              🐝 Bee mode
            </button>
            {book.practice.length > 0 ? (
              <button type="button" className={choiceButton} onClick={onPractice}>
                My practice words ({book.practice.length})
              </button>
            ) : null}
            <button type="button" className={choiceButton} onClick={onPlayFamily}>
              Play with mom/dad
            </button>
          </div>
        </>
      ) : null}

      {step === 'page' ? (
        <>
          <p className={prompt}>Select which page you would like to study.</p>
          <div className="mt-4 grid gap-3">
            {STUDY_PAGES.map((page) => {
              const status = pageStatus(page.id, book, tests)
              const isToday = page.id === today
              return (
                <button
                  key={page.id}
                  type="button"
                  aria-label={`${page.label}, ${status.learned} of ${page.count} learned${status.done ? ', done' : ''}${isToday ? ', today' : ''}`}
                  className={`${touchTarget} w-full rounded-2xl border px-4 py-3 text-left text-lg font-semibold ${
                    status.done
                      ? 'border-green-400/40 bg-green-500/10 text-green-100'
                      : isToday
                        ? 'border-amber-300 bg-amber-400/15 text-stone-50'
                        : 'border-white/10 bg-white/5 text-stone-100'
                  }`}
                  onClick={() => {
                    setPageId(page.id)
                    setStep('scope')
                  }}
                >
                  <span className="flex items-center justify-between">
                    {page.label}
                    {isToday ? (
                      <span className="rounded-full bg-amber-400 px-3 py-0.5 text-sm font-semibold text-[#1c1406]">Today</span>
                    ) : null}
                  </span>
                  <PageProgress status={status} />
                </button>
              )
            })}
          </div>
          <Back onClick={() => setStep('adventure')} />
        </>
      ) : null}

      {step === 'scope' ? (
        <>
          <p className={prompt}>Pick a set of 10, select words, or study the whole page.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {setsOf(wordsForPage(pageId)).map((set, index) => {
              const first = index * SET_SIZE + 1
              const known = set.filter((word) => learned.has(word)).length
              const finished = known === set.length
              const upNext = index === scopeStatus.nextSet
              return (
                <button
                  key={first}
                  type="button"
                  data-testid={`set-${index}`}
                  aria-label={`Words ${first}–${first + set.length - 1}, ${
                    finished ? 'done' : `${known} of ${set.length} learned${upNext ? ', up next' : ''}`
                  }`}
                  className={`${touchTarget} rounded-2xl border px-2 py-2 text-base font-semibold ${
                    finished
                      ? 'border-green-400/50 bg-green-500/15 text-green-200'
                      : upNext
                        ? 'border-amber-300 bg-amber-400 text-[#1c1406]'
                        : 'border-white/10 bg-white/5 text-stone-100'
                  }`}
                  onClick={() => onStartPage(pageId, index)}
                >
                  {finished ? '✓ ' : ''}Words {first}–{first + set.length - 1}
                  {finished ? null : (
                    <span className={`block text-xs font-medium ${upNext ? '' : 'text-stone-400'}`}>
                      {upNext ? `Up next · ${known}/${set.length}` : `${known}/${set.length}`}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-3 grid gap-3">
            {scopeStatus.nextSet === null ? (
              <button
                type="button"
                className={`${touchTarget} w-full rounded-2xl bg-amber-400 px-4 text-lg font-semibold text-[#1c1406]`}
                onClick={() => onStartPageTest(pageId)}
              >
                {scopeStatus.test ? `Retake the page test (last ${scopeStatus.test.score}/${scopeStatus.test.total})` : 'Take the page test'}
              </button>
            ) : (
              <p className="text-center text-sm text-stone-400">The page test opens once every set has a ✓.</p>
            )}
            <button type="button" className={choiceButton} onClick={() => setStep('pick')}>
              Select words
            </button>
            <button type="button" className={choiceButton} onClick={() => onStartPage(pageId)}>
              Study the whole page
            </button>
          </div>
          <Back onClick={() => setStep('page')} />
        </>
      ) : null}

      {step === 'pick' ? (
        <WordPick
          words={wordsForPage(pageId)}
          onPlay={onStartPick}
          onBack={() => setStep('scope')}
          onToggle={playTick}
        />
      ) : null}

      {step === 'difficulty' ? (
        <>
          <p className={prompt}>Please select the difficulty of your quiz.</p>
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

      {step === 'beeTier' ? (
        <>
          <p className={prompt}>Bee mode! Which bee are you ready for?</p>
          <p className="mt-2 text-center text-sm text-stone-400">One try, a minute on the clock, and no taking letters back.</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {BEE_TIERS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={item}
                className={`${touchTarget} rounded-2xl border border-white/10 bg-white/5 px-2 text-base font-semibold text-stone-100`}
                onClick={() => {
                  setTier(item)
                  setStep('beeCount')
                }}
              >
                {item}
                <span className="mt-1 block text-xs font-medium opacity-80">
                  {SPELLING_ENTRIES.filter((entry) => entry.tier === item).length} words
                </span>
              </button>
            ))}
          </div>
          <Back onClick={() => setStep('adventure')} />
        </>
      ) : null}

      {step === 'beeCount' && tier !== null ? (
        <>
          <p className={prompt}>How many words would you like?</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {ROUND_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                className={`${touchTarget} rounded-2xl border border-white/10 bg-white/5 px-2 text-base font-semibold text-stone-100`}
                onClick={() => onStartBee(tier, count)}
              >
                {count} words
              </button>
            ))}
          </div>
          <Back onClick={() => setStep('beeTier')} />
        </>
      ) : null}

      {step === 'count' && difficulty !== null ? (
        <>
          <p className={prompt}>How many words would you like?</p>
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
