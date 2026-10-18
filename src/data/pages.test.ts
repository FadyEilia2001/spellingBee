import { describe, expect, it } from 'vitest'
import { ALL_SPELLING_WORDS } from './words.ts'
import { pageIdForIndex, STUDY_PAGES, wordsForPage } from './pages.ts'

describe('study pages', () => {
  it('splits the current list into pages 1 through 6', () => {
    expect(STUDY_PAGES.map((page) => page.label)).toEqual([
      'Page 1',
      'Page 2',
      'Page 3',
      'Page 4',
      'Page 5',
      'Page 6',
    ])
    expect(STUDY_PAGES.map((page) => page.count).reduce((sum, count) => sum + count, 0)).toBe(450)

    expect(wordsForPage('page-1')).toHaveLength(76)
    expect(wordsForPage('page-1')[0]).toBe('ran')
    expect(wordsForPage('page-1').at(-1)).toBe('money')

    expect(wordsForPage('page-2')).toHaveLength(74)
    expect(wordsForPage('page-2')[0]).toBe('cabin')
    expect(wordsForPage('page-2').at(-1)).toBe('soared')

    expect(wordsForPage('page-3')).toHaveLength(76)
    expect(wordsForPage('page-3')[0]).toBe('buttons')
    expect(wordsForPage('page-3').at(-1)).toBe('piñata')

    expect(wordsForPage('page-4')).toHaveLength(67)
    expect(wordsForPage('page-4')[0]).toBe('newt')
    expect(wordsForPage('page-4').at(-1)).toBe('credenza')

    expect(wordsForPage('page-5')).toHaveLength(74)
    expect(wordsForPage('page-5')[0]).toBe('territory')
    expect(wordsForPage('page-5').at(-1)).toBe('Aeolus')

    expect(wordsForPage('page-6')).toHaveLength(83)
    expect(wordsForPage('page-6')[0]).toBe('comprehensible')
    expect(wordsForPage('page-6').at(-1)).toBe('Cappadocia')
  })

  it('gives every list index one page and rejects an index past the end', () => {
    const seen = ALL_SPELLING_WORDS.map((_, index) => pageIdForIndex(index))
    expect(seen.filter((page) => page === 'page-1')).toHaveLength(76)
    expect(seen.filter((page) => page === 'page-6')).toHaveLength(83)
    expect(() => pageIdForIndex(450)).toThrow('no page for index 450')
  })
})
