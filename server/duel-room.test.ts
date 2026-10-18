// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { startDuelServer } from './duel-room.ts'
import { readOverall } from '../src/study/duel.ts'
import { readFileSync } from 'node:fs'

type View = {
  phase: string
  you: string | null
  seats: Record<string, { attempts: { guess: string }[]; gameScore: number; locked: boolean } | null>
  overall: Record<string, number>
}

const closers: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()))
})

function open(port: number): Promise<{ socket: WebSocket; view: () => View; send: (message: unknown) => void }> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`)
  let latest: View | null = null
  socket.on('message', (data) => {
    latest = JSON.parse(data.toString()).view as View
  })
  return new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.once('open', () => {
      resolve({
        socket,
        view: () => {
          if (!latest) throw new Error('no view yet')
          return latest
        },
        send: (message) => socket.send(JSON.stringify(message)),
      })
    })
  })
}

async function waitFor(read: () => boolean) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (read()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('timed out waiting for the room')
}

describe('family room server', () => {
  it('keeps the overall total on disk and hides guesses until both players finish', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'family-room-'))
    const scoresPath = path.join(dir, 'scores.json')
    const server = await startDuelServer({ port: 0, scoresPath })
    closers.push(server.close)

    const ella = await open(server.port)
    const mom = await open(server.port)
    await waitFor(() => ella.view().phase === 'lobby')
    ella.send({ type: 'sit', seat: 'Ella' })
    mom.send({ type: 'sit', seat: 'Mom' })
    await waitFor(() => ella.view().you === 'Ella' && mom.view().you === 'Mom')

    ella.send({ type: 'options', difficulty: 'short', count: 5 })
    ella.send({ type: 'start', words: ['ran'] })
    await waitFor(() => ella.view().phase === 'spelling')
    ella.send({ type: 'guess', guess: 'ran' })
    await waitFor(() => mom.view().seats.Ella?.locked === true)
    expect(mom.view().seats.Ella?.attempts).toEqual([])
    expect(mom.view().overall.Ella).toBe(0)

    mom.send({ type: 'guess', guess: 'ran' })
    await waitFor(() => mom.view().phase === 'reveal')
    expect(mom.view().seats.Ella?.attempts.map((attempt) => attempt.guess)).toEqual(['ran'])
    expect(readOverall(readFileSync(scoresPath, 'utf8'))).toEqual({ Ella: 3, Mom: 3, Dad: 0 })

    await server.close()
    closers.pop()
    const restarted = await startDuelServer({ port: 0, scoresPath })
    closers.push(restarted.close)
    const returning = await open(restarted.port)
    await waitFor(() => returning.view().overall.Ella === 3)
    expect(returning.view().overall.Mom).toBe(3)
    expect(returning.view().phase).toBe('reveal')
  })
})
