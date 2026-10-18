import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_SPELLING_WORDS } from '../data/words.ts'
import { spellingAudioFilename } from './audioFile.ts'

const audioDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/audio')

function volumeLevels(file: string): { mean: number; max: number } {
  const result = spawnSync('ffmpeg', ['-i', file, '-af', 'volumedetect', '-f', 'null', '-'], {
    encoding: 'utf8',
  })
  const stderr = result.stderr ?? ''
  const mean = Number(/mean_volume:\s*([-\d.]+)/.exec(stderr)?.[1])
  const max = Number(/max_volume:\s*([-\d.]+)/.exec(stderr)?.[1])
  if (!Number.isFinite(mean) || !Number.isFinite(max)) {
    throw new Error(`Could not read volume for ${file}`)
  }
  return { mean, max }
}

describe('spelling audio loudness', () => {
  it('keeps every generated mp3 loud enough to hear', () => {
    const quiet: string[] = []

    for (const word of ALL_SPELLING_WORDS) {
      const file = path.join(audioDir, spellingAudioFilename(word))
      expect(existsSync(file), `missing audio for ${word}`).toBe(true)
      const { mean, max } = volumeLevels(file)
      if (mean < -50 || max < -40) {
        quiet.push(`${word} (mean ${mean} dB, max ${max} dB)`)
      }
    }

    expect(quiet).toEqual([])
  }, 120_000)
})
