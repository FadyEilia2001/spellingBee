import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { connectFamilyRoom, FamilyMatch, familyHomePageUrl, familyMatchLivesHere, type RoomConnection } from './FamilyMatch.tsx'
import { advance, emptyMatch, leave, sit, startMatch, submitGuess, viewFor, type ClientMessage, type DuelView } from './duel.ts'

vi.mock('./soundtrack.ts', () => ({
  hushSoundtrack: vi.fn(),
  restoreSoundtrack: vi.fn(),
}))

vi.mock('./speech.ts', () => ({
  speakWord: vi.fn(),
  stopSpeaking: vi.fn(),
}))

function harness() {
  const sent: ClientMessage[] = []
  let publish: (view: DuelView) => void = () => {}
  const connect = (onView: (view: DuelView) => void, onOpen: (open: boolean) => void): RoomConnection => {
    publish = onView
    onOpen(true)
    onView(viewFor(emptyMatch(), null))
    return {
      send: (message) => {
        sent.push(message)
      },
      close: () => {},
    }
  }
  return { sent, connect, show: (view: DuelView) => publish(view) }
}

describe('family room connection', () => {
  it('reconnects after a drop and sits back in the same seat', () => {
    vi.useFakeTimers()
    const sockets: FakeSocket[] = []
    class FakeSocket extends EventTarget {
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      readyState = 0
      sent: string[] = []
      constructor() {
        super()
        sockets.push(this)
      }
      send(data: string) {
        this.sent.push(data)
      }
      close() {
        this.readyState = 3
      }
      open() {
        this.readyState = 1
        this.dispatchEvent(new Event('open'))
      }
      drop() {
        this.readyState = 3
        this.dispatchEvent(new Event('close'))
      }
    }
    vi.stubGlobal('WebSocket', FakeSocket)
    sessionStorage.clear()
    const opens: boolean[] = []
    const room = connectFamilyRoom(() => {}, (open) => opens.push(open), { rejoin: true })

    sockets[0]!.open()
    room.send({ type: 'sit', seat: 'Ella' })
    sockets[0]!.drop()
    expect(opens).toEqual([true, false])
    vi.advanceTimersByTime(1000)
    expect(sockets).toHaveLength(2)
    sockets[1]!.open()
    expect(sockets[1]!.sent).toEqual([JSON.stringify({ type: 'sit', seat: 'Ella' })])

    room.close()
    sockets[1]!.drop()
    vi.advanceTimersByTime(20_000)
    expect(sockets).toHaveLength(2)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
})

describe('family room address', () => {
  it('points phones at the home page when they are not already there', () => {
    expect(familyHomePageUrl()).toBe('http://10.0.0.187:8787')
    expect(familyMatchLivesHere()).toBe(false)
  })
})

describe('family match screen', () => {
  it('sits down, starts a round, and shows this game plus the overall score', async () => {
    const user = userEvent.setup()
    const room = harness()
    render(<FamilyMatch onBack={vi.fn()} connect={room.connect} />)

    await user.click(screen.getByRole('button', { name: 'Ella' }))
    expect(room.sent.at(-1)).toEqual({ type: 'sit', seat: 'Ella' })

    let match = sit(sit(emptyMatch(), 'Ella'), 'Mom')
    room.show(viewFor(match, 'Ella'))
    await user.click(await screen.findByRole('button', { name: 'Short' }))
    await user.click(screen.getByRole('button', { name: '5 words' }))
    expect(room.sent).toContainEqual({ type: 'options', difficulty: 'short', count: 5 })

    match = { ...match, difficulty: 'short', count: 5 }
    room.show(viewFor(match, 'Ella'))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    const start = room.sent.find((message) => message.type === 'start')
    expect(start && start.type === 'start' ? start.words : []).toHaveLength(5)

    match = startMatch(match, ['ran'])
    match = submitGuess(match, 'Ella', 'ran')
    room.show(viewFor(match, 'Mom'))
    expect((await screen.findByTestId('Ella-game')).textContent).toBe('0')
    expect(screen.getByTestId('Ella-overall').textContent).toBe('0')
    expect(screen.queryByTestId('attempt-tile')).toBeNull()

    match = submitGuess(match, 'Mom', 'ran')
    room.show(viewFor(match, 'Mom'))
    expect(await screen.findByText('Ella got it on the first try · 3')).toBeTruthy()
    expect(screen.getByTestId('Ella-game').textContent).toBe('3')
    expect(screen.getByTestId('Ella-overall').textContent).toBe('3')
    expect(screen.getByTestId('Mom-game').textContent).toBe('3')
    expect(screen.queryByTestId('attempt-tile')).toBeNull()
  })

  it('lets the next person choose an open seat and wait, without the game setup', async () => {
    const user = userEvent.setup()
    const room = harness()
    render(<FamilyMatch host={false} onBack={vi.fn()} connect={room.connect} />)

    expect(screen.queryByText('Hi Ella, choose your adventure.')).toBeNull()
    room.show(viewFor(sit(emptyMatch(), 'Ella'), null))
    expect(await screen.findByRole('button', { name: 'Mom' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dad' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ella' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Short' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Mom' }))
    room.show(viewFor(sit(sit(emptyMatch(), 'Ella'), 'Mom'), 'Mom'))
    expect(await screen.findByText('Waiting for the game to start.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear overall scores' })).toBeNull()

    room.show(viewFor({ ...sit(sit(emptyMatch(), 'Ella'), 'Mom'), difficulty: 'short', count: 5 }, 'Mom'))
    expect(await screen.findByText('Short · 5 words. Waiting for the game to start.')).toBeTruthy()
  })

  it('asks each person to spell, then shows right or wrong without the guesses', async () => {
    const user = userEvent.setup()
    const room = harness()
    render(<FamilyMatch onBack={vi.fn()} connect={room.connect} />)
    await user.click(screen.getByRole('button', { name: 'Ella' }))

    let match = startMatch(sit(sit(emptyMatch(), 'Ella'), 'Mom'), ['ran'])
    room.show(viewFor(match, 'Ella'))
    const box = await screen.findByLabelText('Spell the word')
    expect(screen.getByText('First try')).toBeTruthy()
    expect(screen.getByText('Second try')).toBeTruthy()
    expect(screen.getByText('Third try')).toBeTruthy()
    await user.type(box, 'rannn')
    await user.click(screen.getByRole('button', { name: 'Spell' }))
    expect(room.sent.at(-1)).toEqual({ type: 'guess', guess: 'ran' })
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(3)
    expect(screen.queryByTestId('attempt-tile')).toBeNull()
    expect(screen.queryByText('ran')).toBeNull()

    match = submitGuess(match, 'Ella', 'ran')
    room.show(viewFor(match, 'Ella'))
    expect(await screen.findByText('You got it. Waiting for Mom.')).toBeTruthy()
    expect(screen.queryByText('ran')).toBeNull()

    match = submitGuess(match, 'Mom', 'xyz')
    match = submitGuess(match, 'Mom', 'qqq')
    match = submitGuess(match, 'Mom', 'vvv')
    room.show(viewFor(match, 'Ella'))
    expect(await screen.findByText('Ella got it on the first try · 3')).toBeTruthy()
    expect(screen.getByText('Mom missed · 0')).toBeTruthy()
    expect(screen.getByText('ran')).toBeTruthy()
    expect(screen.queryByText('xyz')).toBeNull()
    expect(screen.getByText('Ella is ahead')).toBeTruthy()
    expect(screen.queryByTestId('attempt-tile')).toBeNull()

    match = advance(match)
    room.show(viewFor(match, 'Ella'))
    expect(await screen.findByText('Ella wins')).toBeTruthy()
    expect(screen.getByText('Ella 3 · Mom 0')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Spell' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('keeps the space as a gap while typing a phrase', async () => {
    const user = userEvent.setup()
    const room = harness()
    render(<FamilyMatch onBack={vi.fn()} connect={room.connect} />)
    await user.click(screen.getByRole('button', { name: 'Ella' }))

    const match = startMatch(sit(sit(emptyMatch(), 'Ella'), 'Mom'), ['a cappella'])
    room.show(viewFor(match, 'Ella'))
    const box = await screen.findByLabelText('Spell the word')

    const slotsBefore = screen.getAllByTestId('letter-slot')
    expect(slotsBefore[1]?.className).toMatch(/\bw-2\b/)

    await user.type(box, 'a cappella')
    const slots = screen.getAllByTestId('letter-slot')
    expect(slots.map((slot) => slot.textContent)).toEqual(['a', '', 'c', 'a', 'p', 'p', 'e', 'l', 'l', 'a'])
    expect(slots[1]?.className).toMatch(/\bw-2\b/)
    expect(slots[1]?.className).not.toMatch(/\bborder\b/)
  })

  it('does not count a short spelling and shows the letters from your own try', async () => {
    const user = userEvent.setup()
    const room = harness()
    render(<FamilyMatch onBack={vi.fn()} connect={room.connect} />)
    await user.click(screen.getByRole('button', { name: 'Ella' }))

    let match = startMatch(sit(sit(emptyMatch(), 'Ella'), 'Mom'), ['ran'])
    room.show(viewFor(match, 'Ella'))
    const box = await screen.findByLabelText('Spell the word')
    await user.type(box, 'r')
    expect((screen.getByRole('button', { name: 'Spell' }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(box, 'at')
    await user.click(screen.getByRole('button', { name: 'Spell' }))
    expect(room.sent.at(-1)).toEqual({ type: 'guess', guess: 'rat' })

    match = submitGuess(match, 'Ella', 'rat')
    room.show(viewFor(match, 'Ella'))
    expect(await screen.findAllByTestId('attempt-tile')).toHaveLength(3)
    expect(screen.getByText('Not quite. 2 tries left.')).toBeTruthy()
  })

  it('tells a late phone the game already started and offers a dropped seat', async () => {
    const user = userEvent.setup()
    const room = harness()
    render(<FamilyMatch host={false} onBack={vi.fn()} connect={room.connect} />)
    const match = startMatch(sit(sit(emptyMatch(), 'Ella'), 'Mom'), ['ran'])
    room.show(viewFor(match, null))
    expect(await screen.findByText('This game already started.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dad' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    expect(room.sent.at(-1)).not.toEqual({ type: 'abandon' })
    await user.click(screen.getByRole('button', { name: 'Yes, start over' }))
    expect(room.sent.at(-1)).toEqual({ type: 'abandon' })

    room.show(viewFor(leave(match, 'Mom'), null))
    expect(await screen.findByRole('button', { name: 'Mom' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dad' })).toBeNull()
  })
})
