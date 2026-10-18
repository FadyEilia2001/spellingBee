import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceScreen } from './ChoiceScreen.tsx'

describe('choice screen', () => {
  it('starts a round only after a difficulty and a word count', async () => {
    const user = userEvent.setup()
    const onStartRound = vi.fn()
    const onStartPage = vi.fn()
    render(<ChoiceScreen onStartRound={onStartRound} onStartPage={onStartPage} />)

    const start = screen.getByRole('button', { name: 'Start round' }) as HTMLButtonElement
    expect(start.disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Short' }))
    expect(start.disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: '5 words' }))
    expect(start.disabled).toBe(false)
    await user.click(start)

    expect(onStartRound).toHaveBeenCalledWith('short', 5)
    expect(onStartPage).not.toHaveBeenCalled()
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-[52px]')
    }
  })

  it('starts the selected page', async () => {
    const user = userEvent.setup()
    const onStartPage = vi.fn()
    render(<ChoiceScreen onStartRound={vi.fn()} onStartPage={onStartPage} />)

    await user.click(screen.getByRole('button', { name: 'Two Bee, page 1' }))

    expect(onStartPage).toHaveBeenCalledWith('two-bee-1')
  })
})
