import { describe, expect, it } from 'vitest'
import { compareSpelling } from './compareSpelling.ts'

function marks(letters: { character: string; ok: boolean }[]): string {
  return letters.map((letter) => (letter.ok ? letter.character : `[${letter.character}]`)).join('')
}

describe('compareSpelling', () => {
  it('marks a left-out letter in the real spelling', () => {
    const result = compareSpelling('buisness', 'business')
    expect(marks(result.wrote)).toBe('bu[i]sness')
    expect(marks(result.spelled)).toBe('bus[i]ness')
  })

  it('marks a missing double letter', () => {
    const result = compareSpelling('acomodate', 'accommodate')
    expect(marks(result.wrote)).toBe('acomodate')
    expect(marks(result.spelled)).toBe('ac[c]om[m]odate')
  })

  it('marks an extra letter in what she wrote', () => {
    expect(marks(compareSpelling('runn', 'run').wrote)).toBe('run[n]')
  })

  it('ignores case and keeps everything ok when right', () => {
    const result = compareSpelling('Apple', 'apple')
    expect(result.wrote.every((letter) => letter.ok)).toBe(true)
    expect(result.spelled.every((letter) => letter.ok)).toBe(true)
  })
})
