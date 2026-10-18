export const LINE_VOLUME = 1
export const EFFECT_VOLUME = 0.5
export const TUNE_VOLUME = 0.22
export const DUCKED_VOLUME = 0.05
export const MUSIC_STORAGE_KEY = 'spellingBee.music'
export const TUNE_URL = '/music/loop.mp3'

export const LINES = {
  adventure: {
    url: '/audio/lines/adventure.mp3',
    text: 'Hi Ella, choose your adventure. You can study a page or embark on a quiz.',
  },
  page: {
    url: '/audio/lines/page.mp3',
    text: 'Select which page you would like to study.',
  },
  difficulty: {
    url: '/audio/lines/difficulty.mp3',
    text: 'Please select the difficulty of your quiz.',
  },
  count: {
    url: '/audio/lines/count.mp3',
    text: 'How many words would you like?',
  },
  yes: {
    url: '/audio/lines/yes.mp3',
    text: 'Yes!',
  },
  tryAgain: {
    url: '/audio/lines/try-again.mp3',
    text: 'Close! Try again.',
  },
  bee: {
    url: '/audio/lines/bee.mp3',
    text: 'Bee mode! Which bee are you ready for?',
  },
  finished: {
    url: '/audio/lines/finished.mp3',
    text: 'You finished!',
  },
} as const

export type LineId = keyof typeof LINES

export const EFFECTS = {
  correct: '/sfx/correct.mp3',
  miss: '/sfx/miss.mp3',
  complete: '/sfx/complete.mp3',
} as const

export type EffectId = keyof typeof EFFECTS

export type MusicPreference = 'playing' | 'paused'

export function readMusicPreference(
  storage: Pick<Storage, 'getItem'> = localStorage,
): MusicPreference {
  return storage.getItem(MUSIC_STORAGE_KEY) === 'paused' ? 'paused' : 'playing'
}

export function writeMusicPreference(
  value: MusicPreference,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(MUSIC_STORAGE_KEY, value)
}
