import { describe, expect, it } from 'vitest'
import { wordsForPage } from '../data/pages.ts'
import { pageStatus, todaysPage, warmupWords } from './pagePlan.ts'

const page1 = wordsForPage('page-1')
const page2 = wordsForPage('page-2')

describe('page plan', () => {
  it('counts learned words and finished sets, and points at the next set', () => {
    const status = pageStatus('page-1', { learned: page1.slice(0, 15), practice: [] }, {})
    expect(status).toMatchObject({ learned: 15, total: 76, sets: 8, setsDone: 1, nextSet: 1, done: false })
  })

  it('is done once every word is learned', () => {
    const book = { learned: page1, practice: [] }
    expect(pageStatus('page-1', book, {}).done).toBe(true)
    expect(pageStatus('page-1', book, {}).nextSet).toBeNull()
  })

  it('makes the first unfinished page todays page', () => {
    const partialBook = { learned: page1.slice(0, 15), practice: [] }
    const fullBook = { learned: page1, practice: [] }
    expect(todaysPage(partialBook, {})).toBe('page-1')
    expect(todaysPage(fullBook, {})).toBe('page-2')
  })

  it('warms up with practice words from earlier pages only', () => {
    const book = { learned: [], practice: [page2[0]!, page1[3]!, page1[4]!] }
    expect(warmupWords(book, 'page-1')).toEqual([])
    expect(warmupWords(book, 'page-2')).toEqual([page1[3], page1[4]])
  })
})
