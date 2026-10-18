# Study Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the speller choose a length difficulty and a round size, or study one original page, and bring any word that is not a first-try spelling back after three other words.

**Architecture:** Pages and letter length are pure lookups over the existing word list. A study queue owns spacing, the four-return cap, and session completion. The screen records stars and asks the queue what word comes next. The app opens on a choice screen and does not build a round by itself.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, localStorage.

**Spec:** `docs/superpowers/specs/2026-10-17-study-rounds-design.md`

**Language:** Use the terms in `CONTEXT.md`: difficulty, page, round, page lesson, clean spelling.

---

## File structure

- Create `src/data/pages.ts` — the six pages, in list order, and the words on each page.
- Create `src/data/pages.test.ts` — page counts and boundary words.
- Create `src/study/difficulty.ts` — letter count, Short / Medium / Long, and the 5 / 10 / 15 choices.
- Create `src/study/difficulty.test.ts` — band counts and the hyphen and space examples.
- Create `src/study/queue.ts` — shuffle, start a round, start a queue, finish a turn, clean count, session tally.
- Create `src/study/queue.test.ts` — spacing, the cap, round size, and page order.
- Create `src/study/ChoiceScreen.tsx` — difficulty, word count, and page buttons.
- Create `src/study/ChoiceScreen.test.tsx` — the buttons call the right callback.
- Modify `src/study/progress.ts` — add `recordTurn`, then remove the review queue from round selection.
- Modify `src/study/progress.test.ts` — stars follow the first try; old saved progress still loads.
- Modify `src/App.tsx` — choice screen, one live turn, forward only, summary.
- Modify `src/App.test.tsx` — start from the choice screen, a miss returns, the summary goes back.
- Leave `src/data/words.ts` unchanged. Page membership is the current 450-word order. Do not edit definitions or sentences.

Tasks 1–5 add behavior beside the current app, so the existing study screen keeps working until Task 6. Task 6 is the cutover. Run the whole suite before every commit.

---

### Task 1: Study pages

**Files:**
- Create: `src/data/pages.test.ts`
- Create: `src/data/pages.ts`

- [ ] **Step 1: Write the failing test**

Create `src/data/pages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ALL_SPELLING_WORDS } from './words.ts'
import { pageIdForIndex, STUDY_PAGES, wordsForPage } from './pages.ts'

describe('study pages', () => {
  it('splits the current list into the six original pages', () => {
    expect(STUDY_PAGES.map((page) => page.count).reduce((sum, count) => sum + count, 0)).toBe(450)

    expect(wordsForPage('one-bee')).toHaveLength(76)
    expect(wordsForPage('one-bee')[0]).toBe('ran')
    expect(wordsForPage('one-bee').at(-1)).toBe('money')

    expect(wordsForPage('two-bee-1')).toHaveLength(74)
    expect(wordsForPage('two-bee-1')[0]).toBe('cabin')
    expect(wordsForPage('two-bee-1').at(-1)).toBe('soared')

    expect(wordsForPage('two-bee-2')).toHaveLength(76)
    expect(wordsForPage('two-bee-2')[0]).toBe('buttons')
    expect(wordsForPage('two-bee-2').at(-1)).toBe('piñata')

    expect(wordsForPage('three-bee-1')).toHaveLength(67)
    expect(wordsForPage('three-bee-1')[0]).toBe('newt')
    expect(wordsForPage('three-bee-1').at(-1)).toBe('credenza')

    expect(wordsForPage('three-bee-2')).toHaveLength(74)
    expect(wordsForPage('three-bee-2')[0]).toBe('territory')
    expect(wordsForPage('three-bee-2').at(-1)).toBe('Aeolus')

    expect(wordsForPage('three-bee-3')).toHaveLength(83)
    expect(wordsForPage('three-bee-3')[0]).toBe('comprehensible')
    expect(wordsForPage('three-bee-3').at(-1)).toBe('Cappadocia')
  })

  it('gives every list index one page and rejects an index past the end', () => {
    const seen = ALL_SPELLING_WORDS.map((_, index) => pageIdForIndex(index))
    expect(seen.filter((page) => page === 'one-bee')).toHaveLength(76)
    expect(seen.filter((page) => page === 'three-bee-3')).toHaveLength(83)
    expect(() => pageIdForIndex(450)).toThrow('no page for index 450')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/pages.test.ts`

Expected: FAIL. Vitest cannot resolve `./pages.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/data/pages.ts`:

```ts
import { ALL_SPELLING_WORDS } from './words.ts'

export const STUDY_PAGES = [
  { id: 'one-bee', label: 'One Bee', count: 76 },
  { id: 'two-bee-1', label: 'Two Bee, page 1', count: 74 },
  { id: 'two-bee-2', label: 'Two Bee, page 2', count: 76 },
  { id: 'three-bee-1', label: 'Three Bee, page 1', count: 67 },
  { id: 'three-bee-2', label: 'Three Bee, page 2', count: 74 },
  { id: 'three-bee-3', label: 'Three Bee, page 3', count: 83 },
] as const

export type StudyPageId = (typeof STUDY_PAGES)[number]['id']

export function pageIdForIndex(index: number): StudyPageId {
  let start = 0
  for (const page of STUDY_PAGES) {
    if (index >= start && index < start + page.count) return page.id
    start += page.count
  }
  throw new Error(`no page for index ${index}`)
}

export function wordsForPage(pageId: StudyPageId): string[] {
  let start = 0
  for (const page of STUDY_PAGES) {
    if (page.id === pageId) return ALL_SPELLING_WORDS.slice(start, start + page.count)
    start += page.count
  }
  throw new Error(`unknown page ${pageId}`)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: the new page tests pass, and the existing suite still passes.

- [ ] **Step 5: Commit**

```bash
git add src/data/pages.ts src/data/pages.test.ts
git commit -m "$(cat <<'EOF'
Record the six study pages so a page lesson can open one sheet at a time.

EOF
)"
```

---

### Task 2: Letter-length difficulty

**Files:**
- Create: `src/study/difficulty.test.ts`
- Create: `src/study/difficulty.ts`

- [ ] **Step 1: Write the failing test**

Create `src/study/difficulty.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ALL_SPELLING_WORDS } from '../data/words.ts'
import {
  DIFFICULTIES,
  difficultyFor,
  letterCount,
  ROUND_COUNTS,
  wordsForDifficulty,
} from './difficulty.ts'

describe('letter length', () => {
  it('counts letters and ignores spaces and hyphens', () => {
    expect(letterCount('cul-de-sac')).toBe(8)
    expect(letterCount('a cappella')).toBe(9)
    expect(letterCount('piñata')).toBe(6)
    expect(difficultyFor('cul-de-sac')).toBe('medium')
    expect(difficultyFor('a cappella')).toBe('long')
    expect(difficultyFor('ran')).toBe('short')
  })

  it('puts every word in exactly one band of longer words', () => {
    expect(ROUND_COUNTS).toEqual([5, 10, 15])
    expect(DIFFICULTIES.map((item) => item.id)).toEqual(['short', 'medium', 'long'])
    expect(wordsForDifficulty(ALL_SPELLING_WORDS, 'short')).toHaveLength(92)
    expect(wordsForDifficulty(ALL_SPELLING_WORDS, 'medium')).toHaveLength(184)
    expect(wordsForDifficulty(ALL_SPELLING_WORDS, 'long')).toHaveLength(174)

    for (const word of wordsForDifficulty(ALL_SPELLING_WORDS, 'short')) {
      expect(letterCount(word)).toBeGreaterThanOrEqual(3)
      expect(letterCount(word)).toBeLessThanOrEqual(5)
    }
    for (const word of wordsForDifficulty(ALL_SPELLING_WORDS, 'medium')) {
      expect(letterCount(word)).toBeGreaterThanOrEqual(6)
      expect(letterCount(word)).toBeLessThanOrEqual(8)
    }
    for (const word of wordsForDifficulty(ALL_SPELLING_WORDS, 'long')) {
      expect(letterCount(word)).toBeGreaterThanOrEqual(9)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/study/difficulty.test.ts`

Expected: FAIL. Vitest cannot resolve `./difficulty.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/study/difficulty.ts`:

```ts
export type Difficulty = 'short' | 'medium' | 'long'

export const DIFFICULTIES = [
  { id: 'short', label: 'Short', detail: '3–5 letters' },
  { id: 'medium', label: 'Medium', detail: '6–8 letters' },
  { id: 'long', label: 'Long', detail: '9 or more letters' },
] as const

export const ROUND_COUNTS = [5, 10, 15] as const

export type RoundCount = (typeof ROUND_COUNTS)[number]

export function letterCount(word: string): number {
  return [...word.normalize('NFC')].filter((character) => /\p{L}/u.test(character)).length
}

export function difficultyFor(word: string): Difficulty {
  const count = letterCount(word)
  if (count <= 5) return 'short'
  if (count <= 8) return 'medium'
  return 'long'
}

export function wordsForDifficulty(words: readonly string[], difficulty: Difficulty): string[] {
  return words.filter((word) => difficultyFor(word) === difficulty)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: the difficulty tests pass, and the existing suite still passes.

- [ ] **Step 5: Commit**

```bash
git add src/study/difficulty.ts src/study/difficulty.test.ts
git commit -m "$(cat <<'EOF'
Classify words by letter length so a round can stay inside one difficulty.

EOF
)"
```

---

### Task 3: Study queue

**Files:**
- Create: `src/study/queue.test.ts`
- Create: `src/study/queue.ts`

A turn that is not a clean spelling is inserted so three other words come first. `RETURN_GAP` is 3. `MAX_APPEARANCES` is 5, which is the first appearance plus four returns. The fifth unfinished turn sets the word aside. `random: () => 0` shuffles `['a','b','c','d']` into `['b','c','d','a']` because every Fisher-Yates swap index is 0.

- [ ] **Step 1: Write the failing test**

Create `src/study/queue.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  cleanCount,
  finishTurn,
  isSessionComplete,
  MAX_APPEARANCES,
  RETURN_GAP,
  sessionTally,
  startQueue,
  startRound,
} from './queue.ts'

describe('study queue', () => {
  it('removes a first try and puts any other result three words later', () => {
    expect(RETURN_GAP).toBe(3)
    const started = startQueue(['a', 'b', 'c', 'd', 'e'])

    const clean = finishTurn(started, true)
    expect(clean.current).toBe('b')
    expect(clean.upcoming).toEqual(['c', 'd', 'e'])
    expect(clean.firstAppearanceClean).toEqual(['a'])
    expect(isSessionComplete(clean)).toBe(false)

    const returned = finishTurn(started, false)
    expect(returned.current).toBe('b')
    expect(returned.upcoming).toEqual(['c', 'd', 'a', 'e'])
    expect(returned.firstAppearanceClean).toEqual([])
  })

  it('waits behind whatever words remain, and repeats immediately when it is the only word', () => {
    const two = finishTurn(startQueue(['a', 'b']), false)
    expect(two.current).toBe('b')
    expect(two.upcoming).toEqual(['a'])

    const only = finishTurn(startQueue(['a']), false)
    expect(only.current).toBe('a')
    expect(only.upcoming).toEqual([])
  })

  it('sets a word aside on the fifth unfinished turn', () => {
    expect(MAX_APPEARANCES).toBe(5)
    let queue = startQueue(['a'])
    for (let turn = 0; turn < 4; turn += 1) {
      queue = finishTurn(queue, false)
      expect(queue.current).toBe('a')
    }

    queue = finishTurn(queue, false)
    expect(queue.current).toBeNull()
    expect(queue.setAside).toEqual(['a'])
    expect(isSessionComplete(queue)).toBe(true)
    expect(sessionTally(queue)).toEqual({
      started: 1,
      cleanOnFirstAppearance: 0,
      cleanAfterReturn: 0,
      setAside: 1,
    })
  })

  it('counts a later first try as clean after practice', () => {
    let queue = finishTurn(startQueue(['a', 'b', 'c', 'd']), false)
    queue = finishTurn(queue, true)
    queue = finishTurn(queue, true)
    queue = finishTurn(queue, true)
    expect(queue.current).toBe('a')

    queue = finishTurn(queue, true)
    expect(queue.cleanAfterReturn).toEqual(['a'])
    expect(cleanCount(queue)).toBe(4)
    expect(sessionTally(queue).cleanOnFirstAppearance).toBe(3)
    expect(sessionTally(queue).cleanAfterReturn).toBe(1)
  })

  it('starts a round from a shuffled count and a page lesson in page order', () => {
    const round = startRound(['a', 'b', 'c', 'd'], 3, () => 0)
    expect(round.started).toEqual(['b', 'c', 'd'])
    expect(round.current).toBe('b')

    const wholeBand = startRound(['a', 'b'], 15, () => 0)
    expect(wholeBand.started).toEqual(['b', 'a'])

    const page = startQueue(['ran', 'rod', 'shy'])
    expect(page.started).toEqual(['ran', 'rod', 'shy'])
    expect(page.current).toBe('ran')
    expect(page.upcoming).toEqual(['rod', 'shy'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/study/queue.test.ts`

Expected: FAIL. Vitest cannot resolve `./queue.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/study/queue.ts`:

```ts
export const RETURN_GAP = 3
export const MAX_APPEARANCES = 5

export type StudyQueue = {
  started: string[]
  current: string | null
  upcoming: string[]
  appearances: Record<string, number>
  firstAppearanceClean: string[]
  cleanAfterReturn: string[]
  setAside: string[]
}

export type SessionTally = {
  started: number
  cleanOnFirstAppearance: number
  cleanAfterReturn: number
  setAside: number
}

function shuffle(words: readonly string[], random: () => number): string[] {
  const copy = [...words]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = copy[index]
    const swapped = copy[swapIndex]
    if (current === undefined || swapped === undefined) continue
    copy[index] = swapped
    copy[swapIndex] = current
  }
  return copy
}

export function startQueue(words: readonly string[]): StudyQueue {
  return {
    started: [...words],
    current: words[0] ?? null,
    upcoming: words.slice(1),
    appearances: {},
    firstAppearanceClean: [],
    cleanAfterReturn: [],
    setAside: [],
  }
}

export function startRound(
  words: readonly string[],
  count: number,
  random: () => number = Math.random,
): StudyQueue {
  return startQueue(shuffle(words, random).slice(0, Math.min(count, words.length)))
}

function moveTo(queue: StudyQueue, upcoming: string[], patch: Partial<StudyQueue>): StudyQueue {
  return {
    ...queue,
    ...patch,
    current: upcoming[0] ?? null,
    upcoming: upcoming.slice(1),
  }
}

export function finishTurn(queue: StudyQueue, firstTryClean: boolean): StudyQueue {
  const word = queue.current
  if (word === null) return queue

  const appearances = (queue.appearances[word] ?? 0) + 1
  const seen = { ...queue.appearances, [word]: appearances }

  if (firstTryClean) {
    const patch =
      appearances === 1
        ? { appearances: seen, firstAppearanceClean: [...queue.firstAppearanceClean, word] }
        : { appearances: seen, cleanAfterReturn: [...queue.cleanAfterReturn, word] }
    return moveTo(queue, queue.upcoming, patch)
  }

  if (appearances >= MAX_APPEARANCES) {
    return moveTo(queue, queue.upcoming, {
      appearances: seen,
      setAside: [...queue.setAside, word],
    })
  }

  const insertAt = Math.min(RETURN_GAP, queue.upcoming.length)
  const inserted = [
    ...queue.upcoming.slice(0, insertAt),
    word,
    ...queue.upcoming.slice(insertAt),
  ]
  return moveTo(queue, inserted, { appearances: seen })
}

export function isSessionComplete(queue: StudyQueue): boolean {
  return queue.current === null
}

export function cleanCount(queue: StudyQueue): number {
  return queue.firstAppearanceClean.length + queue.cleanAfterReturn.length
}

export function sessionTally(queue: StudyQueue): SessionTally {
  return {
    started: queue.started.length,
    cleanOnFirstAppearance: queue.firstAppearanceClean.length,
    cleanAfterReturn: queue.cleanAfterReturn.length,
    setAside: queue.setAside.length,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: the queue tests pass, and the existing suite still passes.

- [ ] **Step 5: Commit**

```bash
git add src/study/queue.ts src/study/queue.test.ts
git commit -m "$(cat <<'EOF'
Bring an unfinished word back after three others so a session can end on first tries.

EOF
)"
```

---

### Task 4: Score a turn from the first try

**Files:**
- Modify: `src/study/progress.test.ts`
- Modify: `src/study/progress.ts`

Add `recordTurn` beside the current `recordResult`. Do not delete `buildRound` or the review queue in this task. The current screen still calls them. Task 6 removes them.

`recordTurn(progress, attemptsUsed, solved)` awards the existing `starsFor` values. The streak increases only when `solved` is true and `attemptsUsed` is 1. Every other finished turn sets the current streak to 0 and keeps the best streak. It does not take a word id, so a later turn can earn stars again.

- [ ] **Step 1: Write the failing test**

Append this block to `src/study/progress.test.ts`. Add `recordTurn` to the import from `./progress.ts`.

```ts
describe('first-try scoring', () => {
  it('continues the streak only on a first try and awards stars by the try used', () => {
    const first = recordTurn(emptyProgress(), 1, true)
    expect(first.totalStars).toBe(3)
    expect(first.currentStreak).toBe(1)
    expect(first.bestStreak).toBe(1)

    const second = recordTurn(first, 2, true)
    expect(second.totalStars).toBe(5)
    expect(second.currentStreak).toBe(0)
    expect(second.bestStreak).toBe(1)

    const third = recordTurn(emptyProgress(), 3, true)
    expect(third.totalStars).toBe(1)
    expect(third.currentStreak).toBe(0)

    const missed = recordTurn(first, 3, false)
    expect(missed.totalStars).toBe(3)
    expect(missed.currentStreak).toBe(0)
    expect(missed.bestStreak).toBe(1)
  })

  it('awards stars again on a later turn', () => {
    const again = recordTurn(recordTurn(emptyProgress(), 1, true), 1, true)
    expect(again.totalStars).toBe(6)
    expect(again.currentStreak).toBe(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/study/progress.test.ts`

Expected: FAIL. `recordTurn` is not exported.

- [ ] **Step 3: Write the minimal implementation**

In `src/study/progress.ts`, insert this function immediately above `recordResult`:

```ts
export function recordTurn(progress: Progress, attemptsUsed: number, solved: boolean): Progress {
  const firstTryClean = solved && attemptsUsed === 1
  const currentStreak = firstTryClean ? progress.currentStreak + 1 : 0
  return {
    ...progress,
    totalStars: progress.totalStars + starsFor(attemptsUsed, solved),
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
  }
}
```

Leave `recordResult`, `buildRound`, `reviewQueue`, and `masteredIds` in place.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: the new scoring tests pass, and the existing suite still passes.

- [ ] **Step 5: Commit**

```bash
git add src/study/progress.ts src/study/progress.test.ts
git commit -m "$(cat <<'EOF'
Score each turn from the first try so a later success does not extend the streak.

EOF
)"
```

---

### Task 5: Choice screen

**Files:**
- Create: `src/study/ChoiceScreen.test.tsx`
- Create: `src/study/ChoiceScreen.tsx`

The choice screen does not start a session by itself. Start round stays disabled until both a difficulty and a count are pressed. A page button starts that page immediately. Every button uses the same 52px touch class the spelling card uses.

- [ ] **Step 1: Write the failing test**

Create `src/study/ChoiceScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceScreen } from './ChoiceScreen.tsx'

describe('choice screen', () => {
  it('starts a round only after a difficulty and a word count', async () => {
    const user = userEvent.setup()
    const onStartRound = vi.fn()
    const onStartPage = vi.fn()
    render(<ChoiceScreen onStartRound={onStartRound} onStartPage={onStartPage} />)

    const start = screen.getByRole('button', { name: 'Start round' }) as HTMLButtonElement
    expect(start.disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Short' }))
    expect(start.disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: '5 words' }))
    expect(start.disabled).toBe(false)
    await user.click(start)

    expect(onStartRound).toHaveBeenCalledWith('short', 5)
    expect(onStartPage).not.toHaveBeenCalled()
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-[52px]')
    }
  })

  it('starts the selected page', async () => {
    const user = userEvent.setup()
    const onStartPage = vi.fn()
    render(<ChoiceScreen onStartRound={vi.fn()} onStartPage={onStartPage} />)

    await user.click(screen.getByRole('button', { name: 'Two Bee, page 1' }))

    expect(onStartPage).toHaveBeenCalledWith('two-bee-1')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/study/ChoiceScreen.test.tsx`

Expected: FAIL. Vitest cannot resolve `./ChoiceScreen.tsx`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/study/ChoiceScreen.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: the choice-screen tests pass, and the existing suite still passes. The app still opens directly into the old 10-word round. That changes in Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/study/ChoiceScreen.tsx src/study/ChoiceScreen.test.tsx
git commit -m "$(cat <<'EOF'
Add the study choice screen so a round or a page can be selected before practice.

EOF
)"
```

---

### Task 6: Play the queue from the spelling card

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/study/progress.ts`
- Modify: `src/study/progress.test.ts`

This task removes the old round builder. After it, the app opens on the choice screen. A round is a fresh shuffle of one difficulty. A page lesson is that page in order. Previous Word and Review missed words are gone. Next Word is enabled only after the current turn is locked. Stars are saved when the turn locks. The queue advances when Next Word is pressed. The clean count shown during the turn includes the current word once that turn is a recorded first-try success, so the number updates before Next Word. The summary shows session stars and the three tally counts, then returns to the choice screen.

`Math.random` is left as the default random source inside `startRound`. The existing test setup replaces `Math.random` with `() => 0`, so the screen and `startRound(..., () => 0)` choose the same words.

- [ ] **Step 1: Replace the progress tests**

Replace `src/study/progress.test.ts` with:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendRoundHistory,
  emptyProgress,
  loadProgress,
  PROGRESS_STORAGE_KEY,
  recordTurn,
  saveProgress,
  starsFor,
} from './progress.ts'

describe('first-try scoring', () => {
  it('awards fewer stars as more attempts are used', () => {
    expect(starsFor(1, true)).toBe(3)
    expect(starsFor(2, true)).toBe(2)
    expect(starsFor(3, true)).toBe(1)
    expect(starsFor(3, false)).toBe(0)
  })

  it('continues the streak only on a first try', () => {
    const first = recordTurn(emptyProgress(), 1, true)
    expect(first.totalStars).toBe(3)
    expect(first.currentStreak).toBe(1)
    expect(first.bestStreak).toBe(1)

    const second = recordTurn(first, 2, true)
    expect(second.totalStars).toBe(5)
    expect(second.currentStreak).toBe(0)
    expect(second.bestStreak).toBe(1)

    const third = recordTurn(emptyProgress(), 3, true)
    expect(third.totalStars).toBe(1)
    expect(third.currentStreak).toBe(0)

    const missed = recordTurn(first, 3, false)
    expect(missed.totalStars).toBe(3)
    expect(missed.currentStreak).toBe(0)
    expect(missed.bestStreak).toBe(1)
  })

  it('awards stars again on a later turn', () => {
    const again = recordTurn(recordTurn(emptyProgress(), 1, true), 1, true)
    expect(again.totalStars).toBe(6)
    expect(again.currentStreak).toBe(2)
  })
})

describe('local progress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and reloads stars, streaks, and session history', () => {
    const saved = appendRoundHistory(
      recordTurn(emptyProgress(), 1, true),
      { stars: 3, correct: 1, total: 5 },
      '2026-10-17T12:00:00.000Z',
    )

    saveProgress(saved)

    expect(loadProgress()).toEqual(saved)
    expect(saved.streakHistory).toEqual([
      {
        completedAt: '2026-10-17T12:00:00.000Z',
        stars: 3,
        correct: 1,
        total: 5,
        accuracy: 0.2,
      },
    ])
  })

  it('keeps stars and streaks when older progress has a review queue', () => {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        totalStars: 4,
        currentStreak: 2,
        bestStreak: 5,
        streakHistory: [],
        masteredIds: ['ran'],
        reviewQueue: ['mist'],
      }),
    )

    expect(loadProgress()).toEqual({
      totalStars: 4,
      currentStreak: 2,
      bestStreak: 5,
      streakHistory: [],
    })
  })

  it('ignores unreadable stored progress', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{')

    expect(loadProgress()).toEqual(emptyProgress())
  })
})
```

- [ ] **Step 2: Run the progress tests to verify they fail**

Run: `npx vitest run src/study/progress.test.ts`

Expected: FAIL. `loadProgress()` still returns `masteredIds` and `reviewQueue`, so the old-progress test does not match.

- [ ] **Step 3: Replace progress storage**

Replace `src/study/progress.ts` with:

```ts
export const PROGRESS_STORAGE_KEY = 'spellingBee.progress'

export type StreakEntry = {
  completedAt: string
  stars: number
  correct: number
  total: number
  accuracy: number
}

export type Progress = {
  totalStars: number
  currentStreak: number
  bestStreak: number
  streakHistory: StreakEntry[]
}

export function emptyProgress(): Progress {
  return {
    totalStars: 0,
    currentStreak: 0,
    bestStreak: 0,
    streakHistory: [],
  }
}

export function starsFor(attemptsUsed: number, solved: boolean): number {
  if (!solved) return 0
  if (attemptsUsed <= 1) return 3
  if (attemptsUsed === 2) return 2
  return 1
}

export function recordTurn(progress: Progress, attemptsUsed: number, solved: boolean): Progress {
  const firstTryClean = solved && attemptsUsed === 1
  const currentStreak = firstTryClean ? progress.currentStreak + 1 : 0
  return {
    ...progress,
    totalStars: progress.totalStars + starsFor(attemptsUsed, solved),
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
  }
}

export function appendRoundHistory(
  progress: Progress,
  summary: { stars: number; correct: number; total: number },
  completedAt = new Date().toISOString(),
): Progress {
  const accuracy = summary.total === 0 ? 0 : summary.correct / summary.total
  return {
    ...progress,
    streakHistory: [
      ...progress.streakHistory,
      {
        completedAt,
        stars: summary.stars,
        correct: summary.correct,
        total: summary.total,
        accuracy,
      },
    ],
  }
}

export function saveProgress(progress: Progress): void {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw) as Partial<Progress>
    const streakHistory = Array.isArray(parsed.streakHistory)
      ? parsed.streakHistory.filter(
          (entry): entry is StreakEntry =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof entry.completedAt === 'string' &&
            typeof entry.stars === 'number' &&
            typeof entry.correct === 'number' &&
            typeof entry.total === 'number' &&
            typeof entry.accuracy === 'number',
        )
      : []

    return {
      totalStars: typeof parsed.totalStars === 'number' ? parsed.totalStars : 0,
      currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
      bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
      streakHistory,
    }
  } catch {
    return emptyProgress()
  }
}
```

- [ ] **Step 4: Replace the screen tests**

Replace `src/App.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_SPELLING_WORDS, entryForWord } from './data/words.ts'
import { wordsForDifficulty } from './study/difficulty.ts'
import { finishTurn, startRound, type StudyQueue } from './study/queue.ts'
import { containsTarget, maskSentence } from './study/sentenceClue.ts'
import App from './App.tsx'

const originalRandom = Math.random

function currentRound(): StudyQueue {
  return startRound(wordsForDifficulty(ALL_SPELLING_WORDS, 'short'), 5, () => 0)
}

beforeEach(() => {
  Math.random = () => 0
})

afterEach(() => {
  Math.random = originalRandom
})

const speakWord = vi.fn()
const stopSpeaking = vi.fn()

vi.mock('./study/speech.ts', () => ({
  speakWord: (...args: unknown[]) => speakWord(...args),
  stopSpeaking: (...args: unknown[]) => stopSpeaking(...args),
}))

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

async function startShortRound(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Short' }))
  await user.click(screen.getByRole('button', { name: '5 words' }))
  await user.click(screen.getByRole('button', { name: 'Start round' }))
}

describe('choice screen', () => {
  beforeEach(() => {
    localStorage.clear()
    speakWord.mockClear()
    stopSpeaking.mockClear()
  })

  it('opens on the choices and does not speak', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Start round' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /spelling guess/i })).toBeNull()
    expect(speakWord).not.toHaveBeenCalled()
  })

  it('starts a short round of five different words', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const round = currentRound()
    expect(screen.getByTestId('clean-count').textContent).toBe('0 of 5')
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(Array.from(round.current ?? '').length)
    expect(screen.queryByRole('button', { name: /previous word/i })).toBeNull()
    expect((screen.getByRole('button', { name: /next word/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('starts the One Bee page at its first word', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'One Bee' }))

    expect(screen.getByTestId('clean-count').textContent).toBe('0 of 76')
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: /hear word/i }))
    expect(speakWord).toHaveBeenCalledWith('ran')
  })
})

describe('study loop', () => {
  beforeEach(() => {
    localStorage.clear()
    speakWord.mockClear()
    stopSpeaking.mockClear()
  })

  it('speaks the current word only when Hear Word is tapped', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const input = screen.getByRole('textbox', { name: /spelling guess/i })
    await user.click(screen.getByRole('button', { name: /hear word/i }))

    expect(speakWord).toHaveBeenCalledTimes(1)
    expect(speakWord).toHaveBeenCalledWith(currentRound().current)
    expect(document.activeElement).toBe(input)
  })

  it('shows a written sentence clue and does not speak it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const word = currentRound().current ?? ''
    const entry = entryForWord(word)
    await user.click(screen.getByRole('button', { name: /in a sentence/i }))

    expect(speakWord).not.toHaveBeenCalled()
    expect(containsTarget(screen.getByTestId('sentence-clue').textContent ?? '', word)).toBe(false)
    expect(screen.getByTestId('clue-definition').textContent).toBe(entry?.definition)
    expect(screen.getByTestId('clue-sentence').textContent).toBe(maskSentence(entry?.sentence ?? '', word))
    expect((screen.getByRole('button', { name: /in a sentence/i }) as HTMLButtonElement).className).toContain(
      'min-h-[52px]',
    )

    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByTestId('sentence-clue')).toBeNull()
  })

  it('moves forward only after the turn is finished', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-[52px]')
    }

    const word = currentRound().current ?? ''
    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), word)
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(screen.getByTestId('clean-count').textContent).toBe('1 of 5')

    await user.click(screen.getByRole('button', { name: /next word/i }))
    const next = finishTurn(currentRound(), true)
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(Array.from(next.current ?? '').length)
    expect(speakWord).not.toHaveBeenCalled()
  })
})

describe('spelling attempts', () => {
  beforeEach(() => {
    localStorage.clear()
    speakWord.mockClear()
    stopSpeaking.mockClear()
  })

  it('fills the letter boxes from the current word as you type', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const word = currentRound().current ?? ''
    const typed = Array.from(word).slice(0, 2).join('')
    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), typed)

    expect(screen.getAllByTestId('letter-slot').map((slot) => slot.textContent)).toEqual([
      ...Array.from(typed),
      ...Array.from({ length: Array.from(word).length - Array.from(typed).length }, () => ''),
    ])
  })

  it('turns a correct guess entirely green', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const word = currentRound().current ?? ''
    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), word)
    await user.click(screen.getByRole('button', { name: /^submit$/i }))

    const tiles = screen.getAllByTestId('attempt-tile')
    expect(tiles.map((tile) => tile.textContent)).toEqual(Array.from(word))
    expect(tiles.every((tile) => tile.dataset.status === 'correct')).toBe(true)
  })

  it('uses an 18px input and reveals the word after three misses', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)
    const input = screen.getByRole('textbox', { name: /spelling guess/i })

    expect(input.style.fontSize).toBe('18px')

    for (const guess of ['xyz', 'dog', 'hat']) {
      await user.type(input, guess)
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
    }

    const revealed = screen.getByTestId('revealed-word')
    expect(revealed.textContent).toBe(currentRound().current)
    expect(revealed.className).toMatch(/font-bold/)
    expect(revealed.className).toMatch(/green/)
    expect(speakWord).toHaveBeenCalledTimes(1)
    expect(speakWord).toHaveBeenCalledWith(currentRound().current)
    expect((input as HTMLInputElement).disabled).toBe(true)
  })

  it('starts the next word with an empty attempt counter', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)
    const input = screen.getByRole('textbox', { name: /spelling guess/i })

    await user.type(input, 'xyz')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(screen.getByText(/1 of 3/).textContent).toMatch(/1 of 3/)
    expect((screen.getByRole('button', { name: /next word/i }) as HTMLButtonElement).disabled).toBe(true)

    await user.type(input, currentRound().current ?? '')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    await user.click(screen.getByRole('button', { name: /next word/i }))

    expect(screen.getByText(/0 of 3/).textContent).toMatch(/0 of 3/)
    expect(screen.queryByTestId('attempt-tile')).toBeNull()
    expect(screen.queryByTestId('revealed-word')).toBeNull()
    expect((input as HTMLInputElement).value).toBe('')
    expect((input as HTMLInputElement).disabled).toBe(false)
  })
})

describe('saved study rounds', () => {
  beforeEach(() => {
    localStorage.clear()
    speakWord.mockClear()
    stopSpeaking.mockClear()
  })

  it('keeps total stars and the streak on the choice screen after a reload', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await startShortRound(user)

    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), currentRound().current ?? '')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(screen.getByTestId('total-stars').textContent).toBe('3')
    expect(screen.getByTestId('current-streak').textContent).toBe('1')
    expect((screen.getByTestId('streak-fill') as HTMLElement).style.width).toBe('10%')

    first.unmount()
    render(<App />)

    expect(screen.getByRole('button', { name: 'Start round' })).toBeTruthy()
    expect(screen.getByTestId('total-stars').textContent).toBe('3')
    expect(screen.getByTestId('current-streak').textContent).toBe('1')
  })

  it('brings a missed word back after three other words', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const missed = currentRound().current ?? ''
    const input = screen.getByRole('textbox', { name: /spelling guess/i })
    for (const guess of ['xyz', 'dog', 'hat']) {
      await user.type(input, guess)
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
    }
    expect(screen.getByTestId('revealed-word').textContent).toBe(missed)

    let queue = finishTurn(currentRound(), false)
    await user.click(screen.getByRole('button', { name: /next word/i }))

    for (let step = 0; step < 3; step += 1) {
      const word = queue.current ?? ''
      await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), word)
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
      queue = finishTurn(queue, true)
      await user.click(screen.getByRole('button', { name: /next word/i }))
    }

    expect(queue.current).toBe(missed)
    await user.click(screen.getByRole('button', { name: /hear word/i }))
    expect(speakWord).toHaveBeenCalledWith(missed)
  })

  it('shows the three counts and returns to the choices', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    let queue = currentRound()
    for (let step = 0; step < queue.started.length; step += 1) {
      await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), queue.current ?? '')
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
      queue = finishTurn(queue, true)
      const next = screen.queryByRole('button', { name: /next word/i })
      if (next) await user.click(next)
    }

    expect(screen.getByTestId('round-summary')).toBeTruthy()
    expect(screen.getByTestId('round-stars').textContent).toMatch(/15/)
    expect(screen.getByTestId('clean-first').textContent).toMatch(/5/)
    expect(screen.getByTestId('clean-later').textContent).toMatch(/0/)
    expect(screen.getByTestId('set-aside').textContent).toMatch(/0/)
    expect(screen.queryByRole('button', { name: /review missed words/i })).toBeNull()

    await user.click(screen.getByRole('button', { name: /back to study choices/i }))
    expect(screen.queryByTestId('round-summary')).toBeNull()
    expect(screen.getByRole('button', { name: 'Start round' })).toBeTruthy()
  })
})
```

- [ ] **Step 5: Run the screen tests to verify they fail**

Run: `npx vitest run src/App.test.tsx`

Expected: FAIL. The app still opens on a spelling input and still builds a 10-word round from `buildRound`, which no longer exists after Step 3. The failure is the missing choice-screen button or a compile error in `App.tsx` from `buildRound`.

- [ ] **Step 6: Replace the screen**

Replace `src/App.tsx` with:

```tsx
import { useRef, useState, type FormEvent } from 'react'
import confetti from 'canvas-confetti'
import { ChevronRight, Flame, Star, Volume2 } from 'lucide-react'
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
  const [clueOpen, setClueOpen] = useState(false)
  const guessRef = useRef<HTMLInputElement>(null)

  const word = queue?.current ?? ''
  const characters = Array.from(word)
  const solved = attempts.some((attempt) => isSolvedGuess(attempt.guess, word))
  const failed = !solved && attempts.length >= MAX_ATTEMPTS
  const locked = solved || failed
  const entry = entryForWord(word)
  const pendingClean = queue !== null && recorded && turnIsClean(attempts, word)
  const shownClean = (queue ? cleanCount(queue) : 0) + (pendingClean ? 1 : 0)

  function openSession(nextQueue: StudyQueue) {
    if (nextQueue.current === null) return
    stopSpeaking()
    setQueue(nextQueue)
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
      if (!nowSolved) speakWord(word)
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
            <p
              data-testid="clean-count"
              className="mt-2 text-center text-sm text-stone-400"
              aria-label={`${shownClean} of ${queue.started.length} words clean`}
            >
              {shownClean} of {queue.started.length}
            </p>

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
          <ChoiceScreen
            onStartRound={startDifficultyRound}
            onStartPage={(pageId) => openSession(startQueue(wordsForPage(pageId)))}
          />
        )}
      </section>
    </main>
  )
}

export default App
```

- [ ] **Step 7: Run the tests and the typecheck**

Run: `npm test`

Expected: all tests pass.

Run: `npx tsc -b --pretty false`

Expected: exit 0. There are no remaining imports of `buildRound`, `recordResult`, `ROUND_SIZE`, `reviewQueue`, or `masteredIds`.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/study/progress.ts src/study/progress.test.ts
git commit -m "$(cat <<'EOF'
Play a chosen round or page from the study queue so an unfinished word returns inside the session.

EOF
)"
```
