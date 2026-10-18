import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WordPick } from './WordPick.tsx'

const words = ['cabin', 'carve', 'earth']

describe('word pick list', () => {
  it('lists the words in the given order with Play disabled', () => {
    render(<WordPick words={words} onPlay={vi.fn()} onBack={vi.fn()} />)

    expect(screen.getByText('Highlight the words you want to play with.')).toBeTruthy()
    const labels = screen.getAllByRole('button').map((button) => button.textContent)
    expect(labels).toEqual(['cabin', 'carve', 'earth', 'Play', 'Back'])
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true)
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-[52px]')
    }
    expect(screen.getByRole('button', { name: 'cabin', pressed: false }).className).toContain('bg-white/5')
    expect(screen.getByRole('button', { name: 'cabin' }).parentElement?.className).toContain('grid-cols-2')
    expect(screen.getByRole('button', { name: 'cabin' }).parentElement?.className).toContain('sm:grid-cols-4')
  })

  it('plays highlighted words in list order', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    render(<WordPick words={words} onPlay={onPlay} onBack={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'earth' }))
    await user.click(screen.getByRole('button', { name: 'cabin' }))

    expect(screen.getByRole('button', { name: 'earth' }).className).toContain('bg-amber-400')
    expect(screen.getByRole('button', { name: 'cabin', pressed: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'carve', pressed: false })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(onPlay).toHaveBeenCalledWith(['cabin', 'earth'])
  })

  it('plays every word in list order when all are highlighted', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    render(<WordPick words={words} onPlay={onPlay} onBack={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'carve' }))
    await user.click(screen.getByRole('button', { name: 'earth' }))
    await user.click(screen.getByRole('button', { name: 'cabin' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(onPlay).toHaveBeenCalledWith(['cabin', 'carve', 'earth'])
  })

  it('disables Play again when the last highlight is cleared', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    const onToggle = vi.fn()
    render(<WordPick words={words} onPlay={onPlay} onBack={vi.fn()} onToggle={onToggle} />)

    await user.click(screen.getByRole('button', { name: 'cabin' }))
    await user.click(screen.getByRole('button', { name: 'cabin' }))

    expect(screen.getByRole('button', { name: 'cabin', pressed: false })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onPlay).not.toHaveBeenCalled()
    expect(onToggle).toHaveBeenNthCalledWith(1, true)
    expect(onToggle).toHaveBeenNthCalledWith(2, false)
  })

  it('goes back without playing', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    const onBack = vi.fn()
    render(<WordPick words={words} onPlay={onPlay} onBack={onBack} />)

    await user.click(screen.getByRole('button', { name: 'earth' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(onBack).toHaveBeenCalledOnce()
    expect(onPlay).not.toHaveBeenCalled()
  })
})
