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
