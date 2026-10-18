import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceScreen } from './ChoiceScreen.tsx'

describe('choice screen', () => {
  it('asks Ella to choose an adventure before pages or a quiz', () => {
    render(<ChoiceScreen onStartRound={vi.fn()} onStartPage={vi.fn()} />)

    expect(screen.getByText('Hi Ella, choose your adventure')).toBeTruthy()
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

    expect(screen.getByText('Please select which page you want to study.')).toBeTruthy()
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

    expect(screen.getByText('Please select the difficulty.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '5 words' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Short' }))

    expect(screen.getByText('Please select how many words.')).toBeTruthy()
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
    expect(screen.getByText('Please select the difficulty.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Long' }))
    await user.click(screen.getByRole('button', { name: '10 words' }))

    expect(onStartPage).not.toHaveBeenCalled()
    expect(onStartRound).toHaveBeenCalledWith('long', 10)
  })
})
