export const RETURN_GAP = 3
export const MAX_APPEARANCES = 5

export type StudyQueue = {
  started: string[]
  current: string | null
  upcoming: string[]
  appearances: Record<string, number>
  firstAppearanceClean: string[]
  cleanAfterReturn: string[]
  setAside: string[]
}

export type SessionTally = {
  started: number
  cleanOnFirstAppearance: number
  cleanAfterReturn: number
  setAside: number
}

function shuffle(words: readonly string[], random: () => number): string[] {
  const copy = [...words]
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

export function startQueue(words: readonly string[]): StudyQueue {
  return {
    started: [...words],
    current: words[0] ?? null,
    upcoming: words.slice(1),
    appearances: {},
    firstAppearanceClean: [],
    cleanAfterReturn: [],
    setAside: [],
  }
}

export function startRound(
  words: readonly string[],
  count: number,
  random: () => number = Math.random,
): StudyQueue {
  return startQueue(shuffle(words, random).slice(0, Math.min(count, words.length)))
}

function moveTo(queue: StudyQueue, upcoming: string[], patch: Partial<StudyQueue>): StudyQueue {
  return {
    ...queue,
    ...patch,
    current: upcoming[0] ?? null,
    upcoming: upcoming.slice(1),
  }
}

export function finishTurn(queue: StudyQueue, firstTryClean: boolean): StudyQueue {
  const word = queue.current
  if (word === null) return queue

  const appearances = (queue.appearances[word] ?? 0) + 1
  const seen = { ...queue.appearances, [word]: appearances }

  if (firstTryClean) {
    const patch =
      appearances === 1
        ? { appearances: seen, firstAppearanceClean: [...queue.firstAppearanceClean, word] }
        : { appearances: seen, cleanAfterReturn: [...queue.cleanAfterReturn, word] }
    return moveTo(queue, queue.upcoming, patch)
  }

  if (appearances >= MAX_APPEARANCES) {
    return moveTo(queue, queue.upcoming, {
      appearances: seen,
      setAside: [...queue.setAside, word],
    })
  }

  const insertAt = Math.min(RETURN_GAP, queue.upcoming.length)
  const inserted = [
    ...queue.upcoming.slice(0, insertAt),
    word,
    ...queue.upcoming.slice(insertAt),
  ]
  return moveTo(queue, inserted, { appearances: seen })
}

export function isSessionComplete(queue: StudyQueue): boolean {
  return queue.current === null
}

export function cleanCount(queue: StudyQueue): number {
  return queue.firstAppearanceClean.length + queue.cleanAfterReturn.length
}

export function sessionTally(queue: StudyQueue): SessionTally {
  return {
    started: queue.started.length,
    cleanOnFirstAppearance: queue.firstAppearanceClean.length,
    cleanAfterReturn: queue.cleanAfterReturn.length,
    setAside: queue.setAside.length,
  }
}
