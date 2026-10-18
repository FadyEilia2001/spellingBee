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

  it('is done only once every word is learned and the test is taken', () => {
    const book = { learned: page1, practice: [] }
    expect(pageStatus('page-1', book, {}).done).toBe(false)
    expect(pageStatus('page-1', book, {}).nextSet).toBeNull()
    expect(pageStatus('page-1', book, { 'page-1': { score: 70, total: 76 } }).done).toBe(true)
  })

  it('makes the first unfinished page today’s page', () => {
    const book = { learned: page1, practice: [] }
    expect(todaysPage(book, {})).toBe('page-1')
    expect(todaysPage(book, { 'page-1': { score: 76, total: 76 } })).toBe('page-2')
  })

  it('warms up with practice words from earlier pages only', () => {
    const book = { learned: [], practice: [page2[0]!, page1[3]!, page1[4]!] }
    expect(warmupWords(book, 'page-1')).toEqual([])
    expect(warmupWords(book, 'page-2')).toEqual([page1[3], page1[4]])
  })
})
