import {
  DUCKED_VOLUME,
  EFFECTS,
  EFFECT_VOLUME,
  LINES,
  LINE_VOLUME,
  TUNE_URL,
  TUNE_VOLUME,
  readMusicPreference,
  writeMusicPreference,
  type EffectId,
  type LineId,
} from './lines.ts'

const FALLBACK_RATE = 0.82

let tune: HTMLAudioElement | null = null
let tickContext: AudioContext | null = null
let lineAudio: HTMLAudioElement | null = null
let ducks = 0
let lineDucked = false
let pendingLine: LineId | null = null
let unlockArmed = false
let unlockSynth: SpeechSynthesis | null = null
let tuneRequest = 0

function applyTuneVolume(): void {
  if (!tune) return
  tune.volume = ducks > 0 ? DUCKED_VOLUME : TUNE_VOLUME
}

export function tuneVolume(): number {
  if (tune) return tune.volume
  return ducks > 0 ? DUCKED_VOLUME : TUNE_VOLUME
}

export function duckTune(): void {
  ducks += 1
  applyTuneVolume()
}

export function unduckTune(): void {
  ducks = Math.max(0, ducks - 1)
  applyTuneVolume()
}

function holdLineDuck(): void {
  if (lineDucked) return
  lineDucked = true
  duckTune()
}

function releaseLineDuck(): void {
  if (!lineDucked) return
  lineDucked = false
  unduckTune()
}

function ensureTune(): HTMLAudioElement {
  if (!tune) {
    tune = new Audio(TUNE_URL)
    tune.loop = true
    applyTuneVolume()
  }
  return tune
}

export function stopLine(): void {
  if (lineAudio) {
    lineAudio.pause()
    lineAudio.src = ''
    lineAudio = null
  }
  pendingLine = null
  releaseLineDuck()
}

function speakLine(id: LineId, synth: SpeechSynthesis): void {
  holdLineDuck()
  if (synth.speaking || synth.pending) synth.cancel()
  const utterance = new SpeechSynthesisUtterance(LINES[id].text)
  utterance.rate = FALLBACK_RATE
  utterance.lang = 'en-US'
  utterance.onend = () => releaseLineDuck()
  synth.resume()
  synth.speak(utterance)
}

function armUnlock(synth: SpeechSynthesis): void {
  unlockSynth = synth
  if (unlockArmed || typeof window === 'undefined') return
  unlockArmed = true
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    unlockArmed = false
    const line = pendingLine
    if (line) playLine(line, unlockSynth ?? synth)
    playTune()
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export function playLine(id: LineId, synth: SpeechSynthesis = window.speechSynthesis): void {
  if (pendingLine === id && lineAudio) return
  stopLine()
  pendingLine = id

  let audio: HTMLAudioElement
  try {
    audio = new Audio(LINES[id].url)
  } catch {
    speakLine(id, synth)
    return
  }

  audio.volume = LINE_VOLUME
  lineAudio = audio
  let failed = false

  const fail = (error: unknown) => {
    if (failed || lineAudio !== audio) return
    failed = true
    lineAudio = null
    const blocked = error instanceof DOMException && error.name === 'NotAllowedError'
    if (blocked || (error instanceof Error && error.name === 'NotAllowedError')) {
      armUnlock(synth)
      return
    }
    speakLine(id, synth)
  }

  audio.addEventListener('ended', () => {
    if (failed || lineAudio !== audio) return
    lineAudio = null
    pendingLine = null
    releaseLineDuck()
  })
  audio.addEventListener('error', () => fail(new Error('missing')))
  void audio.play().then(
    () => {
      if (lineAudio !== audio) {
        audio.pause()
        return
      }
      holdLineDuck()
    },
    fail,
  )
}

export function playTick(on: boolean): void {
  try {
    const Context =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return
    tickContext ??= new Context()
    if (tickContext.state === 'suspended') void tickContext.resume()

    const now = tickContext.currentTime
    const osc = tickContext.createOscillator()
    const gain = tickContext.createGain()
    osc.type = 'sine'
    osc.frequency.value = on ? 880 : 494
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(on ? 0.07 : 0.04, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (on ? 0.07 : 0.05))
    osc.connect(gain)
    gain.connect(tickContext.destination)
    osc.start(now)
    osc.stop(now + 0.08)
  } catch {
    // A tick never blocks a highlight.
  }
}

export function playEffect(id: EffectId): void {
  try {
    const audio = new Audio(EFFECTS[id])
    audio.volume = EFFECT_VOLUME
    void audio.play().catch(() => {})
  } catch {
    // A missing effect never blocks spelling.
  }
}

function playTune(): void {
  if (readMusicPreference() === 'paused') return
  const audio = ensureTune()
  audio.muted = false
  const request = ++tuneRequest
  void audio.play().then(
    () => {
      if (request !== tuneRequest || readMusicPreference() === 'paused') audio.pause()
    },
    (error: unknown) => {
      if (request !== tuneRequest || readMusicPreference() === 'paused') return
      if (error instanceof Error && error.name === 'NotAllowedError') {
        armUnlock(window.speechSynthesis)
      }
    },
  )
}

export function startTune(): void {
  playTune()
}

export function pauseTune(): void {
  writeMusicPreference('paused')
  tuneRequest += 1
  if (!tune) return
  tune.muted = true
  tune.pause()
}

export function resumeTune(): void {
  writeMusicPreference('playing')
  playTune()
}

export function resetSoundtrack(): void {
  stopLine()
  tickContext = null
  if (tune) {
    tune.pause()
    tune.src = ''
    tune = null
  }
  ducks = 0
  unlockArmed = false
  unlockSynth = null
}
