import { render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_SPELLING_WORDS, entryForWord } from './data/words.ts'
import { wordsForDifficulty } from './study/difficulty.ts'
import { finishTurn, startQueue, startRound, type StudyQueue } from './study/queue.ts'
import { wordsForPage } from './data/pages.ts'
import { containsTarget, maskSentence } from './study/sentenceClue.ts'
import App from './App.tsx'

const originalRandom = Math.random

function currentRound(): StudyQueue {
  return startRound(wordsForDifficulty(ALL_SPELLING_WORDS, 'short'), 5, () => 0)
}

beforeEach(() => {
  Math.random = () => 0
  musicPreference = 'playing'
})

afterEach(() => {
  Math.random = originalRandom
})

const speakWord = vi.fn()
const stopSpeaking = vi.fn()
const playLine = vi.fn()
const stopLine = vi.fn()
const playEffect = vi.fn()
const pauseTune = vi.fn()
const resumeTune = vi.fn()
const startTune = vi.fn()
let musicPreference: 'playing' | 'paused' = 'playing'

vi.mock('./study/speech.ts', () => ({
  speakWord: (...args: unknown[]) => speakWord(...args),
  stopSpeaking: (...args: unknown[]) => stopSpeaking(...args),
}))

vi.mock('./study/soundtrack.ts', () => ({
  playLine: (...args: unknown[]) => playLine(...args),
  stopLine: (...args: unknown[]) => stopLine(...args),
  playEffect: (...args: unknown[]) => playEffect(...args),
  playTick: () => {},
  pauseTune: () => {
    musicPreference = 'paused'
    localStorage.setItem('spellingBee.music', 'paused')
    pauseTune()
  },
  resumeTune: () => {
    musicPreference = 'playing'
    localStorage.setItem('spellingBee.music', 'playing')
    resumeTune()
  },
  startTune: (...args: unknown[]) => startTune(...args),
  hushSoundtrack: vi.fn(),
  restoreSoundtrack: vi.fn(),
  readMusicPreference: () => musicPreference,
}))

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

async function startShortRound(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Quiz' }))
  await user.click(screen.getByRole('button', { name: 'Short' }))
  await user.click(screen.getByRole('button', { name: '5 words' }))
}

describe('choice screen', () => {
  beforeEach(() => {
    localStorage.clear()
    speakWord.mockClear()
    stopSpeaking.mockClear()
  })

  it('opens on the choices and does not speak', async () => {
    const user = userEvent.setup()
    const first = render(<App />)

    expect(screen.getByText('Hi Ella, choose your adventure.')).toBeTruthy()
    expect(startTune).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Pause music' }))
    expect(pauseTune).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play music' })).toBeTruthy()

    first.unmount()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Play music' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /spelling guess/i })).toBeNull()
    expect(speakWord).not.toHaveBeenCalled()
  })

  it('starts a short round of five different words', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const round = currentRound()
    expect(screen.getByTestId('clean-count').textContent).toBe('0 of 5')
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(Array.from(round.current ?? '').length)
    expect(screen.queryByRole('button', { name: /previous word/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /next word/i })).toBeNull()
  })

  it('starts page 1 at its first word', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 1\b/ }))
    await user.click(screen.getByRole('button', { name: 'Study the whole page' }))

    expect(screen.getByTestId('memorized-count').textContent).toBe('0')
    expect(screen.getByTestId('remaining-count').textContent).toBe('76')
    expect(screen.queryByTestId('clean-count')).toBeNull()
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: /hear it again/i }))
    expect(speakWord).toHaveBeenCalledWith('ran')
  })

  it('counts a page word as memorized only when the first try is right', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 1\b/ }))
    await user.click(screen.getByRole('button', { name: 'Study the whole page' }))

    const input = screen.getByRole('textbox', { name: /spelling guess/i })
    await user.type(input, 'ran')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(screen.getByTestId('memorized-count').textContent).toBe('1')
    expect(screen.getByTestId('remaining-count').textContent).toBe('75')

    await user.click(screen.getByRole('button', { name: /next word/i }))
    await user.type(input, 'xyz')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    await user.type(input, 'rod')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(screen.getByTestId('memorized-count').textContent).toBe('1')
    expect(screen.getByTestId('remaining-count').textContent).toBe('75')
  })

  it('starts a word pick in page order and brings a miss back', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 2\b/ }))
    await user.click(screen.getByRole('button', { name: 'Select words' }))
    await user.click(screen.getByRole('button', { name: 'half' }))
    await user.click(screen.getByRole('button', { name: 'cabin' }))
    stopLine.mockClear()
    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(stopLine).toHaveBeenCalled()
    expect(screen.getByTestId('memorized-count').textContent).toBe('0')
    expect(screen.getByTestId('remaining-count').textContent).toBe('2')
    expect(screen.queryByTestId('clean-count')).toBeNull()
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(5)
    await user.click(screen.getByRole('button', { name: /hear it again/i }))
    expect(speakWord).toHaveBeenCalledWith('cabin')

    const input = screen.getByRole('textbox', { name: /spelling guess/i })
    for (const guess of ['xxxxx', 'yyyyy', 'zzzzz']) {
      await user.type(input, guess)
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
    }
    await user.click(screen.getByRole('button', { name: /next word/i }))

    expect(screen.getAllByTestId('letter-slot')).toHaveLength(4)
    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), 'half')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(screen.getByTestId('memorized-count').textContent).toBe('1')
    expect(screen.getByTestId('remaining-count').textContent).toBe('1')

    await user.click(screen.getByRole('button', { name: /next word/i }))
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(5)
    await user.click(screen.getByRole('button', { name: /hear it again/i }))
    expect(speakWord).toHaveBeenLastCalledWith('cabin')
  })
})

describe('study loop', () => {
  beforeEach(() => {
    localStorage.clear()
    speakWord.mockClear()
    stopSpeaking.mockClear()
  })

  it('says the word when the turn starts and again on request', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    await waitFor(() => expect(speakWord).toHaveBeenCalledWith(currentRound().current))
    speakWord.mockClear()
    const input = screen.getByRole('textbox', { name: /spelling guess/i })
    await user.click(screen.getByRole('button', { name: /hear it again/i }))

    expect(speakWord).toHaveBeenCalledTimes(1)
    expect(speakWord).toHaveBeenCalledWith(currentRound().current)
    expect(document.activeElement).toBe(input)
  })

  it('shows a written sentence clue and does not speak it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const word = currentRound().current ?? ''
    const entry = entryForWord(word)
    await user.click(screen.getByRole('button', { name: /in a sentence/i }))

    expect(speakWord.mock.calls.every(([spoken]) => spoken === word)).toBe(true)
    expect(containsTarget(screen.getByTestId('sentence-clue').textContent ?? '', word)).toBe(false)
    expect(screen.getByTestId('clue-definition').textContent).toBe(entry?.definition)
    expect(screen.getByTestId('clue-sentence').textContent).toBe(maskSentence(entry?.sentence ?? '', word))
    expect((screen.getByRole('button', { name: /in a sentence/i }) as HTMLButtonElement).className).toContain(
      'min-h-[52px]',
    )

    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByTestId('sentence-clue')).toBeNull()
  })

  it('moves forward only after the turn is finished', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-[52px]')
    }

    const word = currentRound().current ?? ''
    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), word)
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(screen.getByTestId('clean-count').textContent).toBe('1 of 5')

    await user.click(screen.getByRole('button', { name: /next word/i }))
    const next = finishTurn(currentRound(), true)
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(Array.from(next.current ?? '').length)
  })
})

describe('spelling attempts', () => {
  beforeEach(() => {
    localStorage.clear()
    speakWord.mockClear()
    stopSpeaking.mockClear()
  })

  it('fills the letter boxes from the current word as you type', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const word = currentRound().current ?? ''
    const typed = Array.from(word).slice(0, 2).join('')
    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), typed)

    expect(screen.getAllByTestId('letter-slot').map((slot) => slot.textContent)).toEqual([
      ...Array.from(typed),
      ...Array.from({ length: Array.from(word).length - Array.from(typed).length }, () => ''),
    ])
  })

  it('keeps the space as a gap while typing a phrase', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 6\b/ }))
    await user.click(screen.getByRole('button', { name: 'Select words' }))
    await user.click(screen.getByRole('button', { name: 'a cappella' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))

    const slotsBefore = screen.getAllByTestId('letter-slot')
    expect(slotsBefore).toHaveLength(10)
    expect(slotsBefore[1]?.className).toMatch(/\bw-2\b/)
    expect(slotsBefore[1]?.className).not.toMatch(/\bborder\b/)

    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), 'a cappella')

    const slots = screen.getAllByTestId('letter-slot')
    expect(slots.map((slot) => slot.textContent)).toEqual(['a', '', 'c', 'a', 'p', 'p', 'e', 'l', 'l', 'a'])
    expect(slots[1]?.className).toMatch(/\bw-2\b/)
    expect(slots[1]?.className).not.toMatch(/\bborder\b/)
  })

  it('turns a correct guess entirely green', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const word = currentRound().current ?? ''
    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), word)
    await user.click(screen.getByRole('button', { name: /^submit$/i }))

    const tiles = screen.getAllByTestId('attempt-tile')
    expect(tiles.map((tile) => tile.textContent)).toEqual(Array.from(word))
    expect(tiles.every((tile) => tile.dataset.status === 'correct')).toBe(true)
    expect(playEffect).toHaveBeenCalledWith('correct')
    expect(playLine).toHaveBeenCalledWith('yes')
    expect(playEffect).not.toHaveBeenCalledWith('miss')
    expect(screen.queryByTestId('spelling-comparison')).toBeNull()
  })

  it('uses an 18px input and reveals the word after three misses', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)
    const input = screen.getByRole('textbox', { name: /spelling guess/i })

    expect(input.style.fontSize).toBe('18px')

    for (const guess of ['xyz', 'dog', 'hat']) {
      await user.type(input, guess)
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
    }

    const revealed = screen.getByTestId('revealed-word')
    expect(revealed.textContent).toBe(currentRound().current)
    expect(revealed.className).toMatch(/green/)
    expect(screen.getByTestId('you-wrote').textContent).toBe('hat')
    expect(playLine).toHaveBeenCalledWith('tryAgain')
    expect(speakWord).toHaveBeenCalledWith(currentRound().current)
    expect(screen.queryByRole('textbox', { name: /spelling guess/i })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /next word/i }))
  })

  it('starts the next word with an empty attempt counter', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)
    const input = screen.getByRole('textbox', { name: /spelling guess/i })

    await user.type(input, 'xyz')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(screen.getByText(/1 of 3/).textContent).toMatch(/1 of 3/)
    expect(screen.queryByRole('button', { name: /next word/i })).toBeNull()

    await user.type(input, currentRound().current ?? '')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    await user.click(screen.getByRole('button', { name: /next word/i }))

    expect(screen.getByText(/0 of 3/).textContent).toMatch(/0 of 3/)
    expect(screen.queryByTestId('attempt-tile')).toBeNull()
    expect(screen.queryByTestId('revealed-word')).toBeNull()
    expect((screen.getByRole('textbox', { name: /spelling guess/i }) as HTMLInputElement).value).toBe('')
  })
})

describe('typing box focus', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the box focused while the word is open and moves to Next when it is over', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)
    const box = () => screen.getByRole('textbox', { name: /spelling guess/i })
    expect(document.activeElement).toBe(box())

    await user.type(box(), 'xyz')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(document.activeElement).toBe(box())

    await user.click(screen.getByRole('button', { name: /in a sentence/i }))
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(document.activeElement).toBe(box())

    await user.type(box(), currentRound().current ?? '')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /next word/i }))

    await user.click(screen.getByRole('button', { name: /next word/i }))
    expect(document.activeElement).toBe(box())
  })
})

describe('saved study rounds', () => {
  beforeEach(() => {
    localStorage.clear()
    speakWord.mockClear()
    stopSpeaking.mockClear()
  })

  it('keeps stars and picks today’s page back up after a reload', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await user.click(screen.getByTestId('today-button'))
    expect(screen.getByText('Page 1 · Words 1–10')).toBeTruthy()

    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), 'ran')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(screen.getByTestId('total-stars').textContent).toBe('3')
    expect(screen.getByTestId('current-streak').textContent).toBe('1')
    expect((screen.getByTestId('streak-fill') as HTMLElement).style.width).toBe('10%')

    first.unmount()
    render(<App />)

    expect(screen.getByTestId('total-stars').textContent).toBe('3')
    expect(screen.queryByRole('button', { name: /keep going/i })).toBeNull()
    expect(screen.getByTestId('today-button').textContent).toMatch(/Pick up where you left off/)
    await user.click(screen.getByTestId('today-button'))
    expect(screen.getByTestId('memorized-count').textContent).toBe('1')
    expect(screen.getAllByTestId('letter-slot')).toHaveLength(3)
  })

  it('ends a quiz for now without saving it, and keeps the missed word to practice', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const missed = currentRound().current ?? ''
    for (const guess of ['xyz', 'dog', 'hat']) {
      await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), guess)
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
    }
    await user.click(screen.getByRole('button', { name: /i'm done for now/i }))
    await user.click(screen.getByRole('button', { name: /yes, stop here/i }))

    expect(screen.getByText('Nice work for now')).toBeTruthy()
    expect(screen.queryByText(/your spot is saved/i)).toBeNull()
    expect(screen.getByRole('list', { name: /still practicing/i }).textContent).toBe(missed)
    await user.click(screen.getByRole('button', { name: /back to study choices/i }))
    expect(screen.queryByRole('button', { name: /keep going/i })).toBeNull()
    expect(screen.getByTestId('today-button').textContent).toMatch(/Next: Words 1–10/)
    expect(screen.getByRole('button', { name: /my practice words \(1\)/i })).toBeTruthy()
  })

  it('fills in a hyphen for her', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 6\b/ }))
    await user.click(screen.getByRole('button', { name: 'Select words' }))
    await user.click(screen.getByRole('button', { name: 'cul-de-sac' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))

    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), 'culde')
    expect(screen.getAllByTestId('letter-slot').map((slot) => slot.textContent).join('')).toBe('cul-de-')
  })

  it('brings a missed word back after three other words', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    const missed = currentRound().current ?? ''
    const input = screen.getByRole('textbox', { name: /spelling guess/i })
    for (const guess of ['xyz', 'dog', 'hat']) {
      await user.type(input, guess)
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
    }
    expect(screen.getByTestId('revealed-word').textContent).toBe(missed)
    expect(playEffect).toHaveBeenCalledWith('miss')
    expect(speakWord).toHaveBeenCalledWith(missed)

    let queue = finishTurn(currentRound(), false)
    await user.click(screen.getByRole('button', { name: /next word/i }))

    for (let step = 0; step < 3; step += 1) {
      const word = queue.current ?? ''
      await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), word)
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
      const tiles = screen.getAllByTestId('attempt-tile')
      expect(tiles.map((tile) => tile.textContent)).toEqual(Array.from(word))
      expect(tiles.every((tile) => tile.dataset.status === 'correct')).toBe(true)
      queue = finishTurn(queue, true)
      await user.click(screen.getByRole('button', { name: /next word/i }))
    }

    expect(queue.current).toBe(missed)
    speakWord.mockClear()
    await user.click(screen.getByRole('button', { name: /hear it again/i }))
    expect(speakWord).toHaveBeenCalledTimes(1)
    expect(speakWord).toHaveBeenCalledWith(missed)

    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), missed)
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    const returnedTiles = screen.getAllByTestId('attempt-tile')
    expect(returnedTiles.map((tile) => tile.textContent)).toEqual(Array.from(missed))
    expect(returnedTiles.every((tile) => tile.dataset.status === 'correct')).toBe(true)
  })

  it('shows the three counts and returns to the choices', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startShortRound(user)

    let queue = currentRound()
    for (let step = 0; step < queue.started.length; step += 1) {
      await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), queue.current ?? '')
      await user.click(screen.getByRole('button', { name: /^submit$/i }))
      queue = finishTurn(queue, true)
      const next = screen.queryByRole('button', { name: /next word/i })
      if (next) await user.click(next)
    }

    expect(screen.getByTestId('round-summary')).toBeTruthy()
    expect(screen.getByTestId('round-stars').textContent).toMatch(/15/)
    expect(screen.getByTestId('clean-first').textContent).toMatch(/5/)
    expect(screen.getByTestId('clean-later').textContent).toMatch(/0/)
    expect(screen.getByTestId('set-aside').textContent).toMatch(/0/)
    expect(screen.queryByRole('button', { name: /review missed words/i })).toBeNull()
    expect(playEffect).toHaveBeenCalledWith('complete')
    expect(playLine).toHaveBeenCalledWith('finished')

    await user.click(screen.getByRole('button', { name: /back to study choices/i }))
    expect(screen.queryByTestId('round-summary')).toBeNull()
    expect(screen.getByText('Hi Ella, choose your adventure.')).toBeTruthy()
  })
})

describe('page a day', () => {
  beforeEach(() => localStorage.clear())

  const page1 = wordsForPage('page-1')

  it('starts today on the next set of the first unfinished page', async () => {
    const user = userEvent.setup()
    localStorage.setItem('spellingBee.words', JSON.stringify({ learned: page1.slice(0, 10), practice: [] }))
    render(<App />)

    const today = screen.getByTestId('today-button')
    expect(today.textContent).toMatch(/Today: Page 1/)
    expect(today.textContent).toMatch(/Next: Words 11–20/)
    expect(screen.getByTestId('percent-page-1').textContent).toBe('13%')
    await user.click(today)
    expect(screen.getByText('Page 1 · Words 11–20')).toBeTruthy()
  })

  it('marks finished sets, the set up next, and how far along the others are', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'spellingBee.words',
      JSON.stringify({ learned: [...page1.slice(0, 10), ...page1.slice(20, 26)], practice: [] }),
    )
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 1\b/ }))

    expect(screen.getByTestId('set-0').getAttribute('aria-label')).toBe('Words 1–10, done')
    expect(screen.getByTestId('set-1').getAttribute('aria-label')).toBe('Words 11–20, 0 of 10 learned, up next')
    expect(screen.getByTestId('set-2').textContent).toBe('Words 21–306/10')
  })

  it('quizzes 10 random words from the page and shows the page after', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Study a page' }))
    await user.click(screen.getByRole('button', { name: /^Page 1\b/ }))
    await user.click(screen.getByRole('button', { name: /quiz me on this page/i }))

    expect(screen.getByText('Page 1 quiz')).toBeTruthy()
    expect(screen.getByTestId('clean-count').textContent).toBe('0 of 10')
    await user.click(screen.getByRole('button', { name: /i'm done for now/i }))
    await user.click(screen.getByRole('button', { name: /yes, stop here/i }))
    expect(screen.getByTestId('progress-page-1')).toBeTruthy()
  })

  it('finishes the page with the page test and moves today to the next page', async () => {
    const user = userEvent.setup()
    localStorage.setItem('spellingBee.words', JSON.stringify({ learned: page1, practice: [] }))
    localStorage.setItem(
      'spellingBee.session',
      JSON.stringify({ kind: 'pageTest', label: 'Page 1 test', queue: startQueue(['ran']), stars: 0, pageId: 'page-1' }),
    )
    render(<App />)

    expect(screen.getByTestId('today-button').textContent).toMatch(/Pick up where you left off/)
    await user.click(screen.getByTestId('today-button'))
    expect(screen.getByText(/0 of 1 try/)).toBeTruthy()
    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), 'ran')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    await user.click(screen.getByRole('button', { name: /next word/i }))

    expect(screen.getByTestId('page-test-score').textContent).toMatch(/Page 1 test: 1 \/ 1/)
    expect(screen.getByTestId('page-test-score').textContent).toMatch(/Page 1 is done/)
    await user.click(screen.getByRole('button', { name: /back to study choices/i }))
    expect(screen.getByTestId('today-button').textContent).toMatch(/Today: Page 2/)
  })

  it('warms up once a day with missed words from earlier pages, then moves on', async () => {
    const user = userEvent.setup()
    localStorage.setItem('spellingBee.words', JSON.stringify({ learned: page1, practice: [page1[2]] }))
    localStorage.setItem('spellingBee.pageTests', JSON.stringify({ 'page-1': { score: 75, total: 76 } }))
    render(<App />)

    expect(screen.getByTestId('today-button').textContent).toMatch(/Warm-up first/)
    await user.click(screen.getByTestId('today-button'))
    expect(screen.getByText('Warm-up from earlier pages')).toBeTruthy()
    await user.type(screen.getByRole('textbox', { name: /spelling guess/i }), page1[2] ?? '')
    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    await user.click(screen.getByRole('button', { name: /next word/i }))

    await user.click(screen.getByRole('button', { name: /on to page 2/i }))
    expect(screen.getByText('Page 2 · Words 1–10')).toBeTruthy()
  })
})

