import { describe, expect, it } from 'vitest'
import { ALL_SPELLING_WORDS } from './words.ts'
import { factsForWord } from './wordFacts.ts'

describe('word facts', () => {
  it('gives every study word a part of speech and an origin', () => {
    const missing = ALL_SPELLING_WORDS.filter((word) => {
      const facts = factsForWord(word)
      return !facts?.partOfSpeech || !facts.origin
    })
    expect(missing).toEqual([])
  })
})
