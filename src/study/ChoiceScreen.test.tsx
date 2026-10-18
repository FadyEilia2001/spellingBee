import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceScreen } from './ChoiceScreen.tsx'

const playLine = vi.fn()

vi.mock('./soundtrack.ts', () => ({
  playLine: (...args: unknown[]) => playLine(...args),
}))

describe('choice screen', () => {
  it('asks Ella to choose an adventure before pages or a quiz', () => {
    playLine.mockClear()
    render(<ChoiceScreen onStartRound={vi.fn()} onStartPage={vi.fn()} />)

    expect(screen.getByText('Hi Ella, choose your adventure.')).toBeTruthy()
    expect(screen.getByText('You can study a page or embark on a quiz.')).toBeTruthy()
    expect(playLine).toHaveBeenCalledWith('adventure')
    expect(screen.getByRole('button', { name: 'Study a page' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quiz' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Page 1' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Short' })).toBeNull()
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-[52px]')
    }
  })

  it('starts the selected page from the page screen', async () => {
    const user = userEvent.setup()
    const onStartRound = vi.fn()
    const onStartPage = vi.fn()
    render(<ChoiceScreen onStartRound={onStartRound} onStartPage={onStartPage} />)

    await user.click(screen.getByRole('button', { name: 'Study a page' }))

    expect(screen.getByText('Select which page you would like to study.')).toBeTruthy()
    expect(playLine).toHaveBeenCalledWith('page')
    expect(screen.queryByRole('button', { name: 'Quiz' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Page 2' }))

    expect(onStartPage).toHaveBeenCalledWith('page-2')
    expect(onStartRound).not.toHaveBeenCalled()
  })

  it('starts a quiz only after a difficulty and a word count', async () => {
    const user = userEvent.setup()
    const onStartRound = vi.fn()
    render(<ChoiceScreen onStartRound={onStartRound} onStartPage={vi.fn()} />)

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
    render(<ChoiceScreen onStartRound={onStartRound} onStartPage={onStartPage} />)

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
