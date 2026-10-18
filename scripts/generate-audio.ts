import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ALL_SPELLING_WORDS } from '../src/data/words.ts'
import { spellingAudioFilename } from '../src/study/audioFile.ts'
import { LINES, type LineId } from '../src/study/lines.ts'

const ANNOUNCER =
  'You are a spelling bee announcer. Pronounce the word clearly and naturally in American English. Speak slightly slower than normal. Say only the word. Do not spell it and do not add commentary.'

const COACH =
  'You are a warm, enthusiastic spelling coach talking to a child. Speak clearly in American English, with a smile. Say only the words you are given.'

const root = path.resolve(import.meta.dirname, '..')

type Job = {
  text: string
  voice: 'marin' | 'coral'
  instructions: string
  destination: string
}

async function loadKey(): Promise<string> {
  const fromEnv = process.env.OPENAI_API_KEY?.trim()
  if (fromEnv) return fromEnv
  const envPath = path.join(root, '.env')
  const text = await readFile(envPath, 'utf8')
  const line = text.split('\n').find((entry) => entry.startsWith('OPENAI_API_KEY='))
  const key = line?.slice('OPENAI_API_KEY='.length).trim()
  if (!key) throw new Error('OPENAI_API_KEY is missing')
  return key
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function synthesize(key: string, job: Job): Promise<'skipped' | 'written'> {
  if (await exists(job.destination)) return 'skipped'
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: job.voice,
      input: job.text,
      instructions: job.instructions,
      response_format: 'mp3',
    }),
  })
  if (!response.ok) {
    throw new Error(`${job.destination} failed with ${response.status} ${await response.text()}`)
  }
  await mkdir(path.dirname(job.destination), { recursive: true })
  await writeFile(job.destination, Buffer.from(await response.arrayBuffer()))
  return 'written'
}

function jobs(): Job[] {
  const wordJobs = ALL_SPELLING_WORDS.map((word) => ({
    text: word,
    voice: 'marin' as const,
    instructions: ANNOUNCER,
    destination: path.join(root, 'public', 'audio', spellingAudioFilename(word)),
  }))
  const lineJobs = (Object.keys(LINES) as LineId[]).map((id) => ({
    text: LINES[id].text,
    voice: 'coral' as const,
    instructions: COACH,
    destination: path.join(root, 'public', LINES[id].url.slice(1)),
  }))
  return [...wordJobs, ...lineJobs]
}

async function main(): Promise<void> {
  const key = await loadKey()
  const pending = jobs()
  let cursor = 0
  let written = 0
  let skipped = 0
  let failed = 0

  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      const job = pending[cursor]
      cursor += 1
      if (!job) return
      try {
        const result = await synthesize(key, job)
        if (result === 'written') written += 1
        else skipped += 1
      } catch (error) {
        failed += 1
        console.error(error instanceof Error ? error.message : error)
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, () => worker()))
  console.log(`written ${written} skipped ${skipped} failed ${failed}`)
  if (failed > 0) process.exitCode = 1
}

await main()
