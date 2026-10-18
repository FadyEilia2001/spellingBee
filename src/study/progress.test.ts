import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendRoundHistory,
  emptyProgress,
  loadProgress,
  PROGRESS_STORAGE_KEY,
  recordTurn,
  saveProgress,
  starsFor,
} from './progress.ts'

describe('first-try scoring', () => {
  it('awards fewer stars as more attempts are used', () => {
    expect(starsFor(1, true)).toBe(3)
    expect(starsFor(2, true)).toBe(2)
    expect(starsFor(3, true)).toBe(1)
    expect(starsFor(3, false)).toBe(0)
  })

  it('continues the streak only on a first try', () => {
    const first = recordTurn(emptyProgress(), 1, true)
    expect(first.totalStars).toBe(3)
    expect(first.currentStreak).toBe(1)
    expect(first.bestStreak).toBe(1)

    const second = recordTurn(first, 2, true)
    expect(second.totalStars).toBe(5)
    expect(second.currentStreak).toBe(0)
    expect(second.bestStreak).toBe(1)

    const third = recordTurn(emptyProgress(), 3, true)
    expect(third.totalStars).toBe(1)
    expect(third.currentStreak).toBe(0)

    const missed = recordTurn(first, 3, false)
    expect(missed.totalStars).toBe(3)
    expect(missed.currentStreak).toBe(0)
    expect(missed.bestStreak).toBe(1)
  })

  it('awards stars again on a later turn', () => {
    const again = recordTurn(recordTurn(emptyProgress(), 1, true), 1, true)
    expect(again.totalStars).toBe(6)
    expect(again.currentStreak).toBe(2)
  })
})

describe('local progress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and reloads stars, streaks, and session history', () => {
    const saved = appendRoundHistory(
      recordTurn(emptyProgress(), 1, true),
      { stars: 3, correct: 1, total: 5 },
      '2026-10-17T12:00:00.000Z',
    )

    saveProgress(saved)

    expect(loadProgress()).toEqual(saved)
    expect(saved.streakHistory).toEqual([
      {
        completedAt: '2026-10-17T12:00:00.000Z',
        stars: 3,
        correct: 1,
        total: 5,
        accuracy: 0.2,
      },
    ])
  })

  it('keeps stars and streaks when older progress has a review queue', () => {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        totalStars: 4,
        currentStreak: 2,
        bestStreak: 5,
        streakHistory: [],
        masteredIds: ['ran'],
        reviewQueue: ['mist'],
      }),
    )

    expect(loadProgress()).toEqual({
      totalStars: 4,
      currentStreak: 2,
      bestStreak: 5,
      streakHistory: [],
    })
  })

  it('ignores unreadable stored progress', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{')

    expect(loadProgress()).toEqual(emptyProgress())
  })
})
