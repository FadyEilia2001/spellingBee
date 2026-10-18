export const ROUND_SIZE = 10
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
  masteredIds: string[]
  reviewQueue: string[]
}

export function emptyProgress(): Progress {
  return {
    totalStars: 0,
    currentStreak: 0,
    bestStreak: 0,
    streakHistory: [],
    masteredIds: [],
    reviewQueue: [],
  }
}

export function starsFor(attemptsUsed: number, solved: boolean): number {
  if (!solved) return 0
  if (attemptsUsed <= 1) return 3
  if (attemptsUsed === 2) return 2
  return 1
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((value): value is string => typeof value === 'string'))]
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = copy[index]
    const swapped = copy[swapIndex]
    if (current === undefined || swapped === undefined) continue
    copy[index] = swapped
    copy[swapIndex] = current
  }
  return copy
}

export function buildRound(
  words: readonly string[],
  progress: Progress,
  options?: { reviewOnly?: boolean; random?: () => number },
): string[] {
  const random = options?.random ?? Math.random
  const known = new Set(words)
  const review = progress.reviewQueue.filter((word) => known.has(word))
  if (options?.reviewOnly) return shuffle(review, random).slice(0, ROUND_SIZE)

  const mastered = new Set(progress.masteredIds)
  const queued = new Set(review)
  const fresh = words.filter((word) => !mastered.has(word) && !queued.has(word))
  const reviewPick = shuffle(review, random).slice(0, ROUND_SIZE)
  const freshPick = shuffle(fresh, random).slice(0, ROUND_SIZE - reviewPick.length)
  let round = shuffle([...reviewPick, ...freshPick], random)

  if (round.length < ROUND_SIZE) {
    const used = new Set(round)
    const extras = shuffle(
      words.filter((word) => !used.has(word)),
      random,
    )
    round = [...round, ...extras.slice(0, ROUND_SIZE - round.length)]
  }

  return round
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

export function recordResult(
  progress: Progress,
  word: string,
  attemptsUsed: number,
  solved: boolean,
): Progress {
  const needsReview = !solved || attemptsUsed >= 3
  const reviewQueue = progress.reviewQueue.filter((item) => item !== word)
  const masteredIds = progress.masteredIds.filter((item) => item !== word)
  if (needsReview) reviewQueue.push(word)
  else masteredIds.push(word)

  const currentStreak = solved ? progress.currentStreak + 1 : 0

  return {
    ...progress,
    totalStars: progress.totalStars + starsFor(attemptsUsed, solved),
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
    reviewQueue,
    masteredIds,
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
      masteredIds: uniqueStrings(parsed.masteredIds),
      reviewQueue: uniqueStrings(parsed.reviewQueue),
    }
  } catch {
    return emptyProgress()
  }
}
