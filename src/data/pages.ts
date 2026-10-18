import { ALL_SPELLING_WORDS } from './words.ts'

export const STUDY_PAGES = [
  { id: 'page-1', label: 'Page 1', count: 76 },
  { id: 'page-2', label: 'Page 2', count: 74 },
  { id: 'page-3', label: 'Page 3', count: 76 },
  { id: 'page-4', label: 'Page 4', count: 67 },
  { id: 'page-5', label: 'Page 5', count: 74 },
  { id: 'page-6', label: 'Page 6', count: 83 },
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
