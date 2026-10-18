import { describe, expect, it } from 'vitest'
import {
  DUCKED_VOLUME,
  EFFECTS,
  EFFECT_VOLUME,
  LINES,
  LINE_VOLUME,
  MUSIC_STORAGE_KEY,
  TUNE_URL,
  TUNE_VOLUME,
  readMusicPreference,
  writeMusicPreference,
} from './lines.ts'

describe('welcome lines', () => {
  it('names the six recordings and the three effects', () => {
    expect(LINES.adventure).toEqual({
      url: '/audio/lines/adventure.mp3',
      text: 'Hi Ella, choose your adventure. You can study a page or embark on a quiz.',
    })
    expect(LINES.page.text).toBe('Select which page you would like to study.')
    expect(LINES.difficulty.text).toBe('Please select the difficulty of your quiz.')
    expect(LINES.count.text).toBe('How many words would you like?')
    expect(LINES.yes.text).toBe('Yes!')
    expect(LINES.finished.text).toBe('You finished!')
    expect(EFFECTS).toEqual({
      correct: '/sfx/correct.mp3',
      miss: '/sfx/miss.mp3',
      complete: '/sfx/complete.mp3',
    })
    expect(TUNE_URL).toBe('/music/loop.mp3')
    expect(LINE_VOLUME).toBe(1)
    expect(EFFECT_VOLUME).toBe(0.5)
    expect(TUNE_VOLUME).toBe(0.22)
    expect(DUCKED_VOLUME).toBe(0.05)
    expect(MUSIC_STORAGE_KEY).toBe('spellingBee.music')
  })

  it('plays music unless the saved choice is paused', () => {
    const stored = new Map<string, string>()
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        stored.set(key, value)
      },
    }

    expect(readMusicPreference(storage)).toBe('playing')
    stored.set(MUSIC_STORAGE_KEY, 'nope')
    expect(readMusicPreference(storage)).toBe('playing')
    writeMusicPreference('paused', storage)
    expect(readMusicPreference(storage)).toBe('paused')
    writeMusicPreference('playing', storage)
    expect(readMusicPreference(storage)).toBe('playing')
  })
})
