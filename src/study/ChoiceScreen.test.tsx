import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { wordsForPage } from '../data/pages.ts'
import { ChoiceScreen } from './ChoiceScreen.tsx'

const playLine = vi.fn()
const stopLine = vi.fn()

vi.mock('./soundtrack.ts', () => ({
  playLine: (...args: unknown[]) => playLine(...args),
  stopLine: (...args: unknown[]) => stopLine(...args),
  playTick: () => {},
}))

describe('choice screen', () => {
  it('asks Ella to choose an adventure before pages or a quiz', () => {
    playLine.mockClear()
    render(<ChoiceScreen onStartRound={vi.fn()} onStartPage={vi.fn()} onStartPick={vi.fn()} onPlayFamily={vi.fn()} />)

    expect(screen.getByText('Hi Ella, choose your adventure.')).toBeTruthy()
    expect(screen.getByText('You can study a page or embark on a quiz.')).toBeTruthy()
    expect(playLine).toHaveBeenCalledWith('adventure')
    expect(screen.getByRole('button', { name: 'Study a page' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quiz' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play with mom/dad' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Page 1\b/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Short' })).toBeNull()
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-[52px]')
    }
  })

  it('asks how to study the page before starting it', async () => {
    const user = userEvent.setup()
    const onStartRound = vi.fn()
    const onStartPage = vi.fn()
    const onStartPick = vi.fn()
    render(
      <ChoiceScreen onStartRound={onStartRound} onStartPage={onStartPage} onStartPick={onStartPick} onPlayFamily={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    playLine.mockClear()
    stopLine.mockClear()
    await user.click(screen.getByRole('button', { name: /^Page 2\b/ }))

    expect(screen.getByText('Pick a set of 10, select words, or study the whole page.')).toBeTruthy()
    expect(stopLine).toHaveBeenCalled()
    expect(playLine).not.toHaveBeenCalled()
    expect(onStartPage).not.toHaveBeenCalled()
    expect(onStartPick).not.toHaveBeenCalled()
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-[52px]')
    }

    await user.click(screen.getByRole('button', { name: 'Study the whole page' }))
    expect(onStartPage).toHaveBeenCalledWith('page-2')
    expect(onStartRound).not.toHaveBeenCalled()
  })

  it('returns to the page list and plays the page line', async () => {
    const user = userEvent.setup()
    render(<ChoiceScreen onStartRound={vi.fn()} onStartPage={vi.fn()} onStartPick={vi.fn()} onPlayFamily={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 2\b/ }))
    playLine.mockClear()
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Select which page you would like to study.')).toBeTruthy()
    expect(playLine).toHaveBeenCalledWith('page')
  })

  it('lists that page in order and plays the highlighted words', async () => {
    const user = userEvent.setup()
    const onStartPick = vi.fn()
    render(<ChoiceScreen onStartRound={vi.fn()} onStartPage={vi.fn()} onStartPick={onStartPick} onPlayFamily={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 2\b/ }))
    playLine.mockClear()
    stopLine.mockClear()
    await user.click(screen.getByRole('button', { name: 'Select words' }))

    expect(screen.getByText('Highlight the words you want to play with.')).toBeTruthy()
    expect(stopLine).toHaveBeenCalled()
    expect(playLine).not.toHaveBeenCalled()
    const labels = screen.getAllByRole('button').map((button) => button.textContent)
    expect(labels[0]).toBe('cabin')
    expect(labels.at(-3)).toBe('soared')
    expect(labels.slice(0, -2)).toEqual(wordsForPage('page-2'))
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'earth' }))
    await user.click(screen.getByRole('button', { name: 'cabin' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(onStartPick).toHaveBeenCalledWith(['cabin', 'earth'])
  })

  it('clears highlights when she leaves the word list', async () => {
    const user = userEvent.setup()
    const onStartPick = vi.fn()
    render(<ChoiceScreen onStartRound={vi.fn()} onStartPage={vi.fn()} onStartPick={onStartPick} onPlayFamily={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 2\b/ }))
    await user.click(screen.getByRole('button', { name: 'Select words' }))
    await user.click(screen.getByRole('button', { name: 'cabin' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Pick a set of 10, select words, or study the whole page.')).toBeTruthy()
    expect(onStartPick).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Select words' }))
    expect(screen.getByRole('button', { name: 'cabin', pressed: false })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('starts a quiz only after a difficulty and a word count', async () => {
    const user = userEvent.setup()
    const onStartRound = vi.fn()
    render(<ChoiceScreen onStartRound={onStartRound} onStartPage={vi.fn()} onStartPick={vi.fn()} onPlayFamily={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Quiz' }))

    expect(screen.getByText('Please select the difficulty of your quiz.')).toBeTruthy()
    expect(playLine).toHaveBeenCalledWith('difficulty')
    expect(screen.queryByRole('button', { name: '5 words' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Short' }))

    expect(screen.getByText('How many words would you like?')).toBeTruthy()
    expect(playLine).toHaveBeenCalledWith('count')
    expect(onStartRound).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '5 words' }))

    expect(onStartRound).toHaveBeenCalledWith('short', 5)
  })

  it('goes back to the previous screen without starting', async () => {
    const user = userEvent.setup()
    const onStartRound = vi.fn()
    const onStartPage = vi.fn()
    render(
      <ChoiceScreen onStartRound={onStartRound} onStartPage={onStartPage} onStartPick={vi.fn()} onPlayFamily={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: 'Quiz' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Quiz' }))
    await user.click(screen.getByRole('button', { name: 'Short' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Please select the difficulty of your quiz.')).toBeTruthy()
    expect(playLine).toHaveBeenLastCalledWith('difficulty')
    await user.click(screen.getByRole('button', { name: 'Long' }))
    await user.click(screen.getByRole('button', { name: '10 words' }))

    expect(onStartPage).not.toHaveBeenCalled()
    expect(onStartRound).toHaveBeenCalledWith('long', 10)
  })
})
