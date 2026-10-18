import { describe, expect, it } from 'vitest'
import {
  cleanCount,
  finishTurn,
  isSessionComplete,
  MAX_APPEARANCES,
  RETURN_GAP,
  sessionTally,
  startQueue,
  startRound,
} from './queue.ts'

describe('study queue', () => {
  it('removes a first try and puts any other result three words later', () => {
    expect(RETURN_GAP).toBe(3)
    const started = startQueue(['a', 'b', 'c', 'd', 'e'])

    const clean = finishTurn(started, true)
    expect(clean.current).toBe('b')
    expect(clean.upcoming).toEqual(['c', 'd', 'e'])
    expect(clean.firstAppearanceClean).toEqual(['a'])
    expect(isSessionComplete(clean)).toBe(false)

    const returned = finishTurn(started, false)
    expect(returned.current).toBe('b')
    expect(returned.upcoming).toEqual(['c', 'd', 'a', 'e'])
    expect(returned.firstAppearanceClean).toEqual([])
  })

  it('waits behind whatever words remain, and repeats immediately when it is the only word', () => {
    const two = finishTurn(startQueue(['a', 'b']), false)
    expect(two.current).toBe('b')
    expect(two.upcoming).toEqual(['a'])

    const only = finishTurn(startQueue(['a']), false)
    expect(only.current).toBe('a')
    expect(only.upcoming).toEqual([])
  })

  it('sets a word aside on the fifth unfinished turn', () => {
    expect(MAX_APPEARANCES).toBe(5)
    let queue = startQueue(['a'])
    for (let turn = 0; turn < 4; turn += 1) {
      queue = finishTurn(queue, false)
      expect(queue.current).toBe('a')
    }

    queue = finishTurn(queue, false)
    expect(queue.current).toBeNull()
    expect(queue.setAside).toEqual(['a'])
    expect(isSessionComplete(queue)).toBe(true)
    expect(sessionTally(queue)).toEqual({
      started: 1,
      cleanOnFirstAppearance: 0,
      cleanAfterReturn: 0,
      setAside: 1,
    })
  })

  it('counts a later first try as clean after practice', () => {
    let queue = finishTurn(startQueue(['a', 'b', 'c', 'd']), false)
    queue = finishTurn(queue, true)
    queue = finishTurn(queue, true)
    queue = finishTurn(queue, true)
    expect(queue.current).toBe('a')

    queue = finishTurn(queue, true)
    expect(queue.cleanAfterReturn).toEqual(['a'])
    expect(cleanCount(queue)).toBe(4)
    expect(sessionTally(queue).cleanOnFirstAppearance).toBe(3)
    expect(sessionTally(queue).cleanAfterReturn).toBe(1)
  })

  it('starts a round from a shuffled count and a page lesson in page order', () => {
    const round = startRound(['a', 'b', 'c', 'd'], 3, () => 0)
    expect(round.started).toEqual(['b', 'c', 'd'])
    expect(round.current).toBe('b')

    const wholeBand = startRound(['a', 'b'], 15, () => 0)
    expect(wholeBand.started).toEqual(['b', 'a'])

    const page = startQueue(['ran', 'rod', 'shy'])
    expect(page.started).toEqual(['ran', 'rod', 'shy'])
    expect(page.current).toBe('ran')
    expect(page.upcoming).toEqual(['rod', 'shy'])
  })
})
