import { describe, expect, it } from 'vitest'
import {
  advance,
  applyMessage,
  backToLobby,
  clearOverall,
  currentWord,
  emptyMatch,
  emptyOverall,
  leave,
  readMatch,
  readOverall,
  readyNext,
  roomHasCompany,
  sit,
  startMatch,
  submitGuess,
  viewFor,
} from './duel.ts'

function seated() {
  return sit(sit(emptyMatch(), 'Ella'), 'Mom')
}

describe('family match', () => {
  it('lets three people score the same word and hides the other guesses until everyone is done', () => {
    let match = sit(seated(), 'Dad')
    match = startMatch(match, ['ran'])

    match = submitGuess(match, 'Ella', 'ran')
    const whileMomSpells = viewFor(match, 'Mom')
    expect(whileMomSpells.seats.Ella?.gameScore).toBe(0)
    expect(whileMomSpells.seats.Ella?.locked).toBe(true)
    expect(whileMomSpells.seats.Ella?.attempts).toEqual([])
    expect(whileMomSpells.overall.Ella).toBe(0)
    expect(match.phase).toBe('spelling')

    match = submitGuess(match, 'Mom', 'xyz')
    match = submitGuess(match, 'Mom', 'rod')
    expect(match.seats.Mom?.locked).toBe(false)
    match = submitGuess(match, 'Dad', 'ran')
    expect(match.phase).toBe('spelling')
    match = submitGuess(match, 'Mom', 'hat')

    expect(match.phase).toBe('reveal')
    expect(match.seats.Mom?.gameScore).toBe(0)
    expect(match.seats.Dad?.gameScore).toBe(3)
    expect(match.overall).toEqual({ Ella: 3, Mom: 0, Dad: 3 })
    expect(viewFor(match, 'Ella').seats.Mom?.attempts).toHaveLength(3)
  })

  it('refuses a seat that is already taken and starts with two players', () => {
    const taken = sit(seated(), 'Ella')
    expect(taken.seats.Ella?.connected).toBe(true)
    expect(taken.seats.Dad).toBeNull()

    const started = startMatch(seated(), ['cabin'])
    expect(started.phase).toBe('spelling')
    expect(sit(started, 'Dad')).toBe(started)
  })

  it('returns this game to zero on the next start and keeps the overall total', () => {
    let match = startMatch(seated(), ['ran', 'rod'])
    match = submitGuess(match, 'Ella', 'ran')
    match = submitGuess(match, 'Mom', 'ran')
    match = advance(match)
    match = submitGuess(match, 'Ella', 'rod')
    match = submitGuess(match, 'Mom', 'xyz')
    match = submitGuess(match, 'Mom', 'rod')
    match = advance(match)

    expect(match.phase).toBe('done')
    expect(match.seats.Ella?.gameScore).toBe(6)
    expect(match.seats.Mom?.gameScore).toBe(5)
    expect(match.overall.Mom).toBe(5)

    match = backToLobby(match)
    match = startMatch(match, ['shy'])
    expect(match.seats.Ella?.gameScore).toBe(0)
    expect(match.seats.Mom?.gameScore).toBe(0)
    expect(match.overall).toEqual({ Ella: 6, Mom: 5, Dad: 0 })
  })

  it('ignores a second player trying to take a seated name', () => {
    const match = emptyMatch()
    const first = applyMessage(match, null, { type: 'sit', seat: 'Ella' })
    const second = applyMessage(first.match, null, { type: 'sit', seat: 'Ella' })
    expect(first.seat).toBe('Ella')
    expect(second.seat).toBeNull()
    expect(second.match.seats.Ella?.connected).toBe(true)
  })

  it('treats a seated player as a game the next phone can join', () => {
    expect(roomHasCompany(viewFor(emptyMatch(), null))).toBe(false)
    expect(roomHasCompany(viewFor(sit(emptyMatch(), 'Ella'), null))).toBe(true)
  })

  it('reads a saved overall total and ignores a broken file', () => {
    expect(readOverall('{"Ella":4,"Mom":2,"Dad":9}')).toEqual({ Ella: 4, Mom: 2, Dad: 9 })
    expect(readOverall('nope')).toEqual({ Ella: 0, Mom: 0, Dad: 0 })
  })

  it('finishes the word when the last waiting phone drops and ignores a short guess', () => {
    let match = startMatch(seated(), ['ran'])
    expect(submitGuess(match, 'Ella', 'r')).toBe(match)
    match = submitGuess(match, 'Ella', 'ran')
    match = leave(match, 'Mom')
    expect(match.phase).toBe('reveal')
    expect(match.seats.Ella?.gameScore).toBe(3)
    expect(match.history[0]?.word).toBe('ran')
    expect(match.history[0]?.points.Mom).toBe(0)
  })

  it('waits until everyone has seen the word before moving on', () => {
    let match = startMatch(seated(), ['ran', 'rod'])
    match = submitGuess(match, 'Ella', 'ran')
    match = submitGuess(match, 'Mom', 'ran')
    match = readyNext(match, 'Ella')
    expect(match.phase).toBe('reveal')
    match = readyNext(match, 'Mom')
    expect(match.phase).toBe('spelling')
    expect(currentWord(match)).toBe('rod')
    match = submitGuess(match, 'Ella', 'rod')
    match = submitGuess(match, 'Mom', 'rod')
    match = readyNext(match, 'Ella')
    match = readyNext(match, 'Mom')
    expect(match.phase).toBe('done')
    match = readyNext(match, 'Ella')
    expect(match.phase).toBe('done')
    match = readyNext(match, 'Mom')
    expect(match.phase).toBe('lobby')
  })

  it('clears the overall total in the lobby and reloads a saved game with everyone away', () => {
    let match = startMatch(seated(), ['ran'])
    match = submitGuess(match, 'Ella', 'ran')
    match = submitGuess(match, 'Mom', 'ran')
    expect(clearOverall(match)).toBe(match)
    match = backToLobby(advance(match))
    expect(clearOverall(match).overall).toEqual({ Ella: 0, Mom: 0, Dad: 0 })

    const saved = readMatch(
      JSON.stringify({ ...match, phase: 'reveal', words: ['ran'], overall: { Ella: 3, Mom: 3, Dad: 0 } }),
      emptyOverall(),
    )
    expect(saved.phase).toBe('reveal')
    expect(saved.words).toEqual(['ran'])
    expect(saved.seats.Ella?.connected).toBe(false)
    expect(readMatch('nope', emptyOverall()).phase).toBe('lobby')
  })
})
