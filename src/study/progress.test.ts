import { beforeEach, describe, expect, it } from 'vitest'
import { ALL_SPELLING_WORDS } from '../data/words.ts'
import {
  appendRoundHistory,
  buildRound,
  emptyProgress,
  loadProgress,
  PROGRESS_STORAGE_KEY,
  recordResult,
  ROUND_SIZE,
  saveProgress,
  starsFor,
} from './progress.ts'

describe('round sizing', () => {
  it('builds a shuffled 10-word round that still includes review words', () => {
    const progress = {
      ...emptyProgress(),
      masteredIds: ['ran', 'rod'],
      reviewQueue: ['butterflies', 'apple'],
    }

    const round = buildRound(ALL_SPELLING_WORDS, progress, { random: () => 0 })
    const listOrder = buildRound(ALL_SPELLING_WORDS, progress, { random: () => 0.999999 })

    expect(ROUND_SIZE).toBe(10)
    expect(round).toHaveLength(10)
    expect(round).toContain('butterflies')
    expect(round).toContain('apple')
    expect(round).not.toContain('ran')
    expect(round).not.toContain('rod')
    expect(round).not.toEqual(listOrder)
  })

  it('does not always open on the first word in the list', () => {
    const round = buildRound(ALL_SPELLING_WORDS, emptyProgress(), { random: () => 0 })

    expect(round[0]).not.toBe('ran')
    expect(round).not.toEqual(ALL_SPELLING_WORDS.slice(0, ROUND_SIZE))
  })

  it('builds a review round from missed words only', () => {
    const progress = {
      ...emptyProgress(),
      reviewQueue: ['mist', 'sharp'],
    }

    expect(buildRound(ALL_SPELLING_WORDS, progress, { reviewOnly: true, random: () => 0 }).sort()).toEqual([
      'mist',
      'sharp',
    ])
  })
})

describe('spaced repetition', () => {
  it('awards fewer stars as more attempts are used', () => {
    expect(starsFor(1, true)).toBe(3)
    expect(starsFor(2, true)).toBe(2)
    expect(starsFor(3, true)).toBe(1)
    expect(starsFor(3, false)).toBe(0)
  })

  it('queues words that take all 3 attempts or are missed, until a clean solve', () => {
    const failed = recordResult(emptyProgress(), 'butterflies', 3, false)
    expect(failed.reviewQueue).toEqual(['butterflies'])
    expect(failed.masteredIds).toEqual([])
    expect(failed.currentStreak).toBe(0)
    expect(failed.totalStars).toBe(0)

    const shaky = recordResult(emptyProgress(), 'balloon', 3, true)
    expect(shaky.reviewQueue).toEqual(['balloon'])
    expect(shaky.totalStars).toBe(1)
    expect(shaky.currentStreak).toBe(1)

    const mastered = recordResult(shaky, 'balloon', 1, true)
    expect(mastered.reviewQueue).toEqual([])
    expect(mastered.masteredIds).toEqual(['balloon'])
    expect(mastered.totalStars).toBe(4)
    expect(mastered.currentStreak).toBe(2)
    expect(mastered.bestStreak).toBe(2)
  })

  it('resets the current streak after a miss and keeps the best streak', () => {
    const hot = recordResult(recordResult(emptyProgress(), 'ran', 1, true), 'rod', 1, true)
    const missed = recordResult(hot, 'shy', 3, false)

    expect(missed.currentStreak).toBe(0)
    expect(missed.bestStreak).toBe(2)
  })
})

describe('local progress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and reloads stars, streaks, mastered words, and the review queue', () => {
    const saved = appendRoundHistory(
      recordResult(emptyProgress(), 'ran', 1, true),
      { stars: 3, correct: 1, total: 10 },
      '2026-10-17T12:00:00.000Z',
    )

    saveProgress(saved)

    expect(loadProgress()).toEqual(saved)
    expect(saved.streakHistory).toEqual([
      {
        completedAt: '2026-10-17T12:00:00.000Z',
        stars: 3,
        correct: 1,
        total: 10,
        accuracy: 0.1,
      },
    ])
  })

  it('ignores unreadable stored progress', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{')

    expect(loadProgress()).toEqual(emptyProgress())
  })
})
