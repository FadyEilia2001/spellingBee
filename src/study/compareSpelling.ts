export type ComparedLetter = { character: string; ok: boolean }

export type SpellingComparison = {
  wrote: ComparedLetter[]
  spelled: ComparedLetter[]
}

function same(a: string, b: string): boolean {
  return a.normalize('NFC').toLocaleLowerCase('en-US') === b.normalize('NFC').toLocaleLowerCase('en-US')
}

// Letters in the longest common subsequence are "ok"; the rest are what she
// added (in what she wrote) or left out (in the real spelling).
export function compareSpelling(guess: string, word: string): SpellingComparison {
  const wrote = Array.from(guess.normalize('NFC'))
  const spelled = Array.from(word.normalize('NFC'))
  const lengths = Array.from({ length: wrote.length + 1 }, () => new Array<number>(spelled.length + 1).fill(0))
  for (let i = wrote.length - 1; i >= 0; i -= 1) {
    for (let j = spelled.length - 1; j >= 0; j -= 1) {
      lengths[i]![j] = same(wrote[i]!, spelled[j]!)
        ? lengths[i + 1]![j + 1]! + 1
        : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!)
    }
  }

  const wroteOk = wrote.map(() => false)
  const spelledOk = spelled.map(() => false)
  let i = 0
  let j = 0
  while (i < wrote.length && j < spelled.length) {
    if (same(wrote[i]!, spelled[j]!)) {
      wroteOk[i] = true
      spelledOk[j] = true
      i += 1
      j += 1
    } else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) {
      i += 1
    } else {
      j += 1
    }
  }

  return {
    wrote: wrote.map((character, index) => ({ character, ok: wroteOk[index]! })),
    spelled: spelled.map((character, index) => ({ character, ok: spelledOk[index]! })),
  }
}
