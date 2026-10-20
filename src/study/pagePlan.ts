import { STUDY_PAGES, wordsForPage, type StudyPageId } from '../data/pages.ts'
import type { WordBook } from './learned.ts'

export const PAGE_TESTS_STORAGE_KEY = 'spellingBee.pageTests'
export const WARMUP_STORAGE_KEY = 'spellingBee.warmup'
export const SET_SIZE = 10
export const WARMUP_SIZE = 8

export type PageTests = Partial<Record<StudyPageId, { score: number; total: number }>>

export type PageStatus = {
  pageId: StudyPageId
  learned: number
  total: number
  sets: number
  setsDone: number
  nextSet: number | null
  test: { score: number; total: number } | null
  done: boolean
}

export function setsOf(words: readonly string[]): string[][] {
  const sets: string[][] = []
  for (let start = 0; start < words.length; start += SET_SIZE) sets.push(words.slice(start, start + SET_SIZE))
  return sets
}

export function pageStatus(pageId: StudyPageId, book: WordBook, tests: PageTests): PageStatus {
  const learned = new Set(book.learned)
  const words = wordsForPage(pageId)
  const sets = setsOf(words)
  const setDone = sets.map((set) => set.every((word) => learned.has(word)))
  const learnedCount = words.filter((word) => learned.has(word)).length
  const test = tests[pageId] ?? null
  const nextSet = setDone.indexOf(false)
  return {
    pageId,
    learned: learnedCount,
    total: words.length,
    sets: sets.length,
    setsDone: setDone.filter(Boolean).length,
    nextSet: nextSet === -1 ? null : nextSet,
    test,
    done: learnedCount === words.length,
  }
}

// Today's page is the first one that isn't done, so a page that takes two
// days stays today's page until it is.
export function todaysPage(book: WordBook, tests: PageTests): StudyPageId | null {
  return STUDY_PAGES.find((page) => !pageStatus(page.id, book, tests).done)?.id ?? null
}

export function warmupWords(book: WordBook, today: StudyPageId): string[] {
  const earlier = STUDY_PAGES.slice(0, STUDY_PAGES.findIndex((page) => page.id === today)).flatMap((page) =>
    wordsForPage(page.id),
  )
  const fromEarlier = new Set(earlier)
  const practice = book.practice.filter((word) => fromEarlier.has(word)).slice(0, 4)
  const practiceSet = new Set(practice)
  const learnedReview = book.learned
    .filter((word) => fromEarlier.has(word) && !practiceSet.has(word))
    .sort(() => Math.random() - 0.5)
    .slice(0, WARMUP_SIZE - practice.length)
  return [...practice, ...learnedReview]
}

export function loadPageTests(): PageTests {
  try {
    const parsed = JSON.parse(localStorage.getItem(PAGE_TESTS_STORAGE_KEY) ?? '{}') as Record<string, unknown>
    const tests: PageTests = {}
    for (const page of STUDY_PAGES) {
      const result = parsed[page.id] as { score?: unknown; total?: unknown } | undefined
      if (typeof result?.score === 'number' && typeof result.total === 'number') {
        tests[page.id] = { score: result.score, total: result.total }
      }
    }
    return tests
  } catch {
    return {}
  }
}

export function savePageTests(tests: PageTests): void {
  try {
    localStorage.setItem(PAGE_TESTS_STORAGE_KEY, JSON.stringify(tests))
  } catch {
    // ponytail: storage blocked; the page test just won't be remembered.
  }
}

export function lastWarmupDay(): string | null {
  try {
    return localStorage.getItem(WARMUP_STORAGE_KEY)
  } catch {
    return null
  }
}

export function markWarmup(day: string): void {
  try {
    localStorage.setItem(WARMUP_STORAGE_KEY, day)
  } catch {
    // ponytail: storage blocked; she may get the warm-up twice today.
  }
}
