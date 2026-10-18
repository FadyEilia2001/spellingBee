import { STUDY_PAGES, type StudyPageId } from '../data/pages.ts'
import type { StudyQueue } from './queue.ts'

export const SESSION_STORAGE_KEY = 'spellingBee.session'

export type SessionKind = 'round' | 'page' | 'pick' | 'practice' | 'bee' | 'pageTest' | 'warmup'

export type SavedSession = {
  kind: SessionKind
  label: string
  queue: StudyQueue
  stars: number
  pageId?: StudyPageId
}

const KINDS: readonly SessionKind[] = ['round', 'page', 'pick', 'practice', 'bee', 'pageTest', 'warmup']

function isWords(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isQueue(value: unknown): value is StudyQueue {
  if (typeof value !== 'object' || value === null) return false
  const queue = value as Record<string, unknown>
  return (
    isWords(queue.started) &&
    (queue.current === null || typeof queue.current === 'string') &&
    isWords(queue.upcoming) &&
    typeof queue.appearances === 'object' &&
    queue.appearances !== null &&
    isWords(queue.firstAppearanceClean) &&
    isWords(queue.cleanAfterReturn) &&
    isWords(queue.setAside)
  )
}

export function saveSession(session: SavedSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // ponytail: storage full or blocked; the session just won't resume.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // nothing to clear
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedSession>
    if (!KINDS.includes(parsed.kind as SessionKind)) return null
    if (typeof parsed.label !== 'string' || typeof parsed.stars !== 'number') return null
    if (!isQueue(parsed.queue) || parsed.queue.current === null) return null
    if (parsed.pageId !== undefined && !STUDY_PAGES.some((page) => page.id === parsed.pageId)) return null
    return parsed as SavedSession
  } catch {
    return null
  }
}

export function wordsLeft(queue: StudyQueue): number {
  return new Set([queue.current, ...queue.upcoming].filter((word) => word !== null)).size
}
