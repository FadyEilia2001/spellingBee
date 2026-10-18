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
