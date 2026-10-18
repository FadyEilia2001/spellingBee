export type LetterMark = 'correct' | 'present' | 'absent'

export const MAX_ATTEMPTS = 3

function letters(value: string): string[] {
  return Array.from(value.normalize('NFC').toLocaleLowerCase('en-US'))
}

export function evaluateGuess(guess: string, target: string): LetterMark[] {
  const guessChars = letters(guess)
  const targetChars = letters(target)
  const marks: LetterMark[] = guessChars.map(() => 'absent')
  const leftover = new Map<string, number>()

  for (let index = 0; index < targetChars.length; index += 1) {
    const letter = targetChars[index] ?? ''
    if (index < guessChars.length && guessChars[index] === letter) {
      marks[index] = 'correct'
    } else {
      leftover.set(letter, (leftover.get(letter) ?? 0) + 1)
    }
  }

  for (let index = 0; index < guessChars.length; index += 1) {
    if (marks[index] === 'correct') continue
    const letter = guessChars[index] ?? ''
    const available = leftover.get(letter) ?? 0
    if (available > 0) {
      marks[index] = 'present'
      leftover.set(letter, available - 1)
    }
  }

  return marks
}

export function isSolvedGuess(guess: string, target: string): boolean {
  const marks = evaluateGuess(guess, target)
  return marks.length === letters(target).length && marks.every((mark) => mark === 'correct')
}
