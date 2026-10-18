import { describe, expect, it } from 'vitest'
import { evaluateGuess } from './evaluateGuess.ts'

describe('evaluateGuess', () => {
  it('marks a correct spelling entirely green', () => {
    expect(evaluateGuess('ran', 'ran')).toEqual(['correct', 'correct', 'correct'])
    expect(evaluateGuess('RAN', 'ran')).toEqual(['correct', 'correct', 'correct'])
    expect(evaluateGuess('Piñata', 'piñata')).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ])
  })

  it('marks misplaced letters yellow only while copies remain', () => {
    expect(evaluateGuess('llllbbb', 'balloon')).toEqual([
      'absent',
      'absent',
      'correct',
      'correct',
      'present',
      'absent',
      'absent',
    ])

    expect(evaluateGuess('ttttttttttt', 'butterflies')).toEqual([
      'absent',
      'absent',
      'correct',
      'correct',
      'absent',
      'absent',
      'absent',
      'absent',
      'absent',
      'absent',
      'absent',
    ])
  })

  it('marks letters that are not in the word as absent', () => {
    expect(evaluateGuess('xyz', 'ran')).toEqual(['absent', 'absent', 'absent'])
    expect(evaluateGuess('arn', 'ran')).toEqual(['present', 'present', 'correct'])
  })
})
