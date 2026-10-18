export const PROGRESS_STORAGE_KEY = 'spellingBee.progress'

export type StreakEntry = {
  completedAt: string
  stars: number
  correct: number
  total: number
  accuracy: number
}

export type Progress = {
  totalStars: number
  currentStreak: number
  bestStreak: number
  streakHistory: StreakEntry[]
}

export function emptyProgress(): Progress {
  return {
    totalStars: 0,
    currentStreak: 0,
    bestStreak: 0,
    streakHistory: [],
  }
}

export function starsFor(attemptsUsed: number, solved: boolean): number {
  if (!solved) return 0
  if (attemptsUsed <= 1) return 3
  if (attemptsUsed === 2) return 2
  return 1
}

export function recordTurn(progress: Progress, attemptsUsed: number, solved: boolean): Progress {
  const firstTryClean = solved && attemptsUsed === 1
  const currentStreak = firstTryClean ? progress.currentStreak + 1 : 0
  return {
    ...progress,
    totalStars: progress.totalStars + starsFor(attemptsUsed, solved),
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
  }
}

export function appendRoundHistory(
  progress: Progress,
  summary: { stars: number; correct: number; total: number },
  completedAt = new Date().toISOString(),
): Progress {
  const accuracy = summary.total === 0 ? 0 : summary.correct / summary.total
  return {
    ...progress,
    streakHistory: [
      ...progress.streakHistory,
      {
        completedAt,
        stars: summary.stars,
        correct: summary.correct,
        total: summary.total,
        accuracy,
      },
    ],
  }
}

export function saveProgress(progress: Progress): void {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw) as Partial<Progress>
    const streakHistory = Array.isArray(parsed.streakHistory)
      ? parsed.streakHistory.filter(
          (entry): entry is StreakEntry =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof entry.completedAt === 'string' &&
            typeof entry.stars === 'number' &&
            typeof entry.correct === 'number' &&
            typeof entry.total === 'number' &&
            typeof entry.accuracy === 'number',
        )
      : []

    return {
      totalStars: typeof parsed.totalStars === 'number' ? parsed.totalStars : 0,
      currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
      bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
      streakHistory,
    }
  } catch {
    return emptyProgress()
  }
}
