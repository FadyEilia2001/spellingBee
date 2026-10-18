import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DUCKED_VOLUME, EFFECT_VOLUME, LINE_VOLUME, TUNE_VOLUME } from './lines.ts'
import {
  duckTune,
  pauseTune,
  playEffect,
  playLine,
  playTick,
  resetSoundtrack,
  resumeTune,
  startTune,
  stopLine,
  tuneVolume,
  unduckTune,
} from './soundtrack.ts'

class SpeechSynthesisUtteranceStub {
  text: string
  rate = 1
  lang = ''
  voice: SpeechSynthesisVoice | null = null
  onend: (() => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

class FakeAudio {
  static instances: FakeAudio[] = []

  src: string
  volume = 1
  loop = false
  paused = true
  private listeners = new Map<string, Set<() => void>>()

  constructor(src?: string) {
    this.src = src ?? ''
    FakeAudio.instances.push(this)
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener()
  }

  play() {
    this.paused = false
    return playImpl(this)
  }

  pause() {
    this.paused = true
  }
}

let playImpl: (audio: FakeAudio) => Promise<void> = () => Promise.resolve()

function mockSynth(speak: (utterance: SpeechSynthesisUtterance) => void = () => {}): SpeechSynthesis {
  return {
    speaking: false,
    pending: false,
    paused: false,
    speak,
    cancel: () => {},
    resume: () => {},
    pause: () => {},
    getVoices: () => [],
  } as SpeechSynthesis
}

beforeEach(() => {
  resetSoundtrack()
  localStorage.clear()
  FakeAudio.instances = []
  playImpl = () => Promise.resolve()
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('SpeechSynthesisUtterance', SpeechSynthesisUtteranceStub)
})

describe('soundtrack', () => {
  it('plays a welcome line and ducks the tune until the line ends', async () => {
    startTune()
    await Promise.resolve()
    playLine('adventure', mockSynth())
    await Promise.resolve()

    const tune = FakeAudio.instances[0]
    const line = FakeAudio.instances[1]
    expect(tune?.src).toBe('/music/loop.mp3')
    expect(tune?.loop).toBe(true)
    expect(line?.src).toBe('/audio/lines/adventure.mp3')
    expect(line?.volume).toBe(LINE_VOLUME)
    expect(tuneVolume()).toBe(DUCKED_VOLUME)

    line?.dispatch('ended')
    expect(tuneVolume()).toBe(TUNE_VOLUME)
  })

  it('plays a higher tick when a word is highlighted and a lower tick when it is cleared', () => {
    const frequencies: number[] = []

    class FakeContext {
      state = 'running'
      currentTime = 0
      resume() {}
      createOscillator() {
        const osc = {
          type: 'sine',
          frequency: { value: 0 },
          connect() {},
          start() {
            frequencies.push(osc.frequency.value)
          },
          stop() {},
        }
        return osc
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
        }
      }
    }

    vi.stubGlobal('AudioContext', FakeContext)
    playTick(true)
    playTick(false)
    expect(frequencies).toEqual([880, 494])
  })

  it('plays an effect without changing the tune', async () => {
    startTune()
    await Promise.resolve()
    const before = tuneVolume()
    playEffect('correct')
    await Promise.resolve()

    const effect = FakeAudio.instances.at(-1)
    expect(effect?.src).toBe('/sfx/correct.mp3')
    expect(effect?.volume).toBe(EFFECT_VOLUME)
    expect(tuneVolume()).toBe(before)
  })

  it('speaks a line when its recording cannot play', async () => {
    playImpl = () => Promise.reject(new Error('missing'))
    const spoken: SpeechSynthesisUtterance[] = []
    playLine('page', mockSynth((utterance) => spoken.push(utterance)))
    await Promise.resolve()
    await Promise.resolve()

    expect(spoken).toHaveLength(1)
    expect(spoken[0]?.text).toBe('Select which page you would like to study.')
    expect(spoken[0]?.rate).toBe(0.82)
    expect(spoken[0]?.lang).toBe('en-US')
  })

  it('pauses only the tune and remembers that choice', async () => {
    startTune()
    await Promise.resolve()
    pauseTune()

    expect(localStorage.getItem('spellingBee.music')).toBe('paused')
    expect(FakeAudio.instances[0]?.paused).toBe(true)

    resumeTune()
    await Promise.resolve()
    expect(localStorage.getItem('spellingBee.music')).toBe('playing')
    expect(FakeAudio.instances[0]?.paused).toBe(false)
  })

  it('stays paused when a tune play starts after the pause click', async () => {
    let startPlayback: (() => void) | undefined
    playImpl = (audio) =>
      new Promise((resolve) => {
        startPlayback = () => {
          audio.paused = false
          resolve()
        }
      })

    startTune()
    pauseTune()
    startPlayback?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(localStorage.getItem('spellingBee.music')).toBe('paused')
    expect(FakeAudio.instances[0]?.paused).toBe(true)
  })

  it('does not start the tune when music is paused', () => {
    localStorage.setItem('spellingBee.music', 'paused')
    startTune()
    expect(FakeAudio.instances).toHaveLength(0)
  })

  it('counts overlapping ducks', () => {
    startTune()
    duckTune()
    duckTune()
    expect(tuneVolume()).toBe(DUCKED_VOLUME)
    unduckTune()
    expect(tuneVolume()).toBe(DUCKED_VOLUME)
    unduckTune()
    expect(tuneVolume()).toBe(TUNE_VOLUME)
  })

  it('does not restart a line that is already playing', async () => {
    playLine('adventure', mockSynth())
    await Promise.resolve()
    playLine('adventure', mockSynth())
    await Promise.resolve()

    expect(FakeAudio.instances.filter((audio) => audio.src.includes('adventure'))).toHaveLength(1)
  })

  it('stops the current line', async () => {
    playLine('yes', mockSynth())
    await Promise.resolve()
    stopLine()
    expect(FakeAudio.instances[0]?.paused).toBe(true)
    expect(tuneVolume()).toBe(TUNE_VOLUME)
  })
})
