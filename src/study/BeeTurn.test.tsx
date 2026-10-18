import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BEE_SECONDS, BeeTurn } from './BeeTurn.tsx'

const speakWord = vi.fn()

vi.mock('./speech.ts', () => ({
  speakWord: (...args: unknown[]) => speakWord(...args),
  stopSpeaking: () => {},
}))

vi.mock('./soundtrack.ts', () => ({
  playEffect: () => {},
  playLine: () => {},
}))

beforeEach(() => {
  vi.useFakeTimers()
  speakWord.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

function type(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: /spell it/i }), { target: { value } })
}

describe('Bee mode turn', () => {
  it('says the word, shows no letter boxes, and answers the asks', () => {
    render(<BeeTurn word="quail" onDone={() => {}} onNext={() => {}} />)
    act(() => vi.advanceTimersByTime(400))
    expect(speakWord).toHaveBeenCalledWith('quail')
    expect(screen.queryByTestId('letter-slot')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Part of speech' }))
    fireEvent.click(screen.getByRole('button', { name: 'Origin' }))
    expect(screen.getByTestId('bee-partOfSpeech').textContent).toBe('noun')
    expect(screen.getByTestId('bee-origin').textContent).toBe('Dutch, through French')
  })

  it('never takes a letter back and gives one try', () => {
    const onDone = vi.fn()
    render(<BeeTurn word="quail" onDone={onDone} onNext={() => {}} />)
    type('quo')
    type('qu')
    expect((screen.getByRole('textbox', { name: /spell it/i }) as HTMLInputElement).value).toBe('quo')

    type('quoil')
    fireEvent.click(screen.getByRole('button', { name: 'Done spelling' }))
    expect(onDone).toHaveBeenCalledWith(false)
    expect(screen.getByTestId('you-wrote').textContent).toBe('quoil')
    expect(screen.queryByRole('textbox', { name: /spell it/i })).toBeNull()
    expect(screen.getByRole('button', { name: /next word/i })).toBeTruthy()
  })

  it('submits what she typed when the clock runs out', () => {
    const onDone = vi.fn()
    render(<BeeTurn word="quail" onDone={onDone} onNext={() => {}} />)
    type('quail')
    act(() => vi.advanceTimersByTime(BEE_SECONDS * 1000))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith(true)
    expect(screen.getByTestId('bee-correct')).toBeTruthy()
  })
})
