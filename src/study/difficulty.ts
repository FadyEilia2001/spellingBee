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
