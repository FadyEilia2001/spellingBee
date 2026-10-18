export const WORDS_STORAGE_KEY = 'spellingBee.words'

// learned: spelled cleanly at least once. practice: missed and not learned yet.
export type WordBook = { learned: string[]; practice: string[] }

export function emptyBook(): WordBook {
  return { learned: [], practice: [] }
}

export function noteWord(book: WordBook, word: string, clean: boolean): WordBook {
  if (clean) {
    return {
      learned: book.learned.includes(word) ? book.learned : [...book.learned, word],
      practice: book.practice.filter((item) => item !== word),
    }
  }
  if (book.learned.includes(word) || book.practice.includes(word)) return book
  return { ...book, practice: [...book.practice, word] }
}

export function learnedCount(book: WordBook, words: readonly string[]): number {
  const learned = new Set(book.learned)
  return words.filter((word) => learned.has(word)).length
}

export function loadBook(): WordBook {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORDS_STORAGE_KEY) ?? '{}') as Partial<WordBook>
    const words = (value: unknown) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    return { learned: words(parsed.learned), practice: words(parsed.practice) }
  } catch {
    return emptyBook()
  }
}

export function saveBook(book: WordBook): void {
  try {
    localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(book))
  } catch {
    // ponytail: storage blocked; learned words just won't be remembered.
  }
}
