export const DAYS_STORAGE_KEY = 'spellingBee.days'
export const DAY_GOAL = 10

// Words finished on each local day, keyed "YYYY-MM-DD".
export type Days = Record<string, number>

export function localDay(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dayBefore(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return localDay(new Date(year!, month! - 1, date! - 1))
}

export function recordWord(days: Days, today: string = localDay()): Days {
  return { ...days, [today]: (days[today] ?? 0) + 1 }
}

// Days in a row that reached the goal. Today still counts toward the streak
// before she reaches the goal, so the number doesn't drop to 0 each morning.
export function dayStreak(days: Days, today: string = localDay()): number {
  let day = (days[today] ?? 0) >= DAY_GOAL ? today : dayBefore(today)
  let streak = 0
  while ((days[day] ?? 0) >= DAY_GOAL) {
    streak += 1
    day = dayBefore(day)
  }
  return streak
}

export function loadDays(): Days {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAYS_STORAGE_KEY) ?? '{}') as Record<string, unknown>
    const days: Days = {}
    for (const [day, count] of Object.entries(parsed)) {
      if (typeof count === 'number') days[day] = count
    }
    return days
  } catch {
    return {}
  }
}

export function saveDays(days: Days): void {
  try {
    localStorage.setItem(DAYS_STORAGE_KEY, JSON.stringify(days))
  } catch {
    // ponytail: storage blocked; the streak just won't grow.
  }
}
