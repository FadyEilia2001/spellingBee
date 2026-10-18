import { beforeEach, describe, expect, it } from 'vitest'
import { dayStreak, DAY_GOAL, recordWord, type Days } from './daily.ts'
import { emptyBook, noteWord } from './learned.ts'
import { startQueue } from './queue.ts'
import { loadSession, saveSession, SESSION_STORAGE_KEY, wordsLeft } from './savedSession.ts'

describe('daily streak', () => {
  it('counts days in a row that reached the goal', () => {
    const days: Days = { '2026-10-16': DAY_GOAL, '2026-10-17': DAY_GOAL + 3, '2026-10-18': 2 }
    expect(dayStreak(days, '2026-10-18')).toBe(2)
    expect(dayStreak({ ...days, '2026-10-18': DAY_GOAL }, '2026-10-18')).toBe(3)
  })

  it('breaks on a missed day and crosses months', () => {
    expect(dayStreak({ '2026-09-30': DAY_GOAL, '2026-10-01': DAY_GOAL }, '2026-10-01')).toBe(2)
    expect(dayStreak({ '2026-10-15': DAY_GOAL, '2026-10-17': DAY_GOAL }, '2026-10-18')).toBe(1)
  })

  it('adds one word to today', () => {
    expect(recordWord({ '2026-10-18': 4 }, '2026-10-18')).toEqual({ '2026-10-18': 5 })
  })
})

describe('word book', () => {
  it('moves a word from practice to learned on a clean spelling', () => {
    const missed = noteWord(emptyBook(), 'quail', false)
    expect(missed.practice).toEqual(['quail'])
    const learned = noteWord(missed, 'quail', true)
    expect(learned).toEqual({ learned: ['quail'], practice: [] })
    expect(noteWord(learned, 'quail', false)).toEqual({ learned: ['quail'], practice: ['quail'] })
  })
})

describe('saved session', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a session and rejects a broken one', () => {
    const session = { kind: 'page' as const, label: 'Page 1', queue: startQueue(['ran', 'rod']), stars: 3 }
    saveSession(session)
    expect(loadSession()).toEqual(session)
    localStorage.setItem(SESSION_STORAGE_KEY, '{"kind":"page"}')
    expect(loadSession()).toBeNull()
  })

  it('counts a returning word once', () => {
    expect(wordsLeft({ ...startQueue(['ran', 'rod']), upcoming: ['rod', 'ran'] })).toBe(2)
  })
})
