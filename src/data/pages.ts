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
