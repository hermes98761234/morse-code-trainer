import { describe, expect, it } from 'vitest'
import { charFor, duration, encodeWav, fromMorseString, MORSE, PROSIGNS, schedule, synthesize, timing, toMorseString, tokenize } from './morse'

describe('table', () => {
  it('matches known ITU patterns', () => {
    expect(MORSE.A).toBe('.-')
    expect(MORSE.Q).toBe('--.-')
    expect(MORSE['0']).toBe('-----')
    expect(MORSE['?']).toBe('..--..')
    expect(MORSE['/']).toBe('-..-.')
    expect(PROSIGNS.AR).toBe('.-.-.')
    expect(PROSIGNS.SK).toBe('...-.-')
  })
  it('has no duplicate patterns', () => {
    for (const t of [MORSE, PROSIGNS]) expect(new Set(Object.values(t)).size).toBe(Object.values(t).length)
  })
  it('round-trips text', () => {
    const s = 'CQ CQ DE UR5ABC K'
    expect(fromMorseString(toMorseString(s))).toBe(s)
    expect(toMorseString('SOS')).toBe('... --- ...')
    expect(toMorseString('E T')).toBe('. / -')
    expect(charFor('.-.-.')).toBe('<AR>')
  })
  it('tokenizes prosigns and skips unknown characters', () => {
    expect(tokenize('a<AR>b').map((t) => t.text)).toEqual(['A', '<AR>', 'B'])
    expect(tokenize('A#  B ').map((t) => t.text)).toEqual(['A', ' ', 'B'])
  })
})

describe('timing', () => {
  it('PARIS at 20 WPM has a 60 ms dot', () => {
    expect(timing(20).dit).toBeCloseTo(0.06, 6)
    expect(timing(20).gapChar).toBeCloseTo(0.18, 6)
    expect(timing(20).gapWord).toBeCloseTo(0.42, 6)
  })
  it('PARIS takes exactly 50 dot lengths including the word gap', () => {
    const sch = schedule('PARIS PARIS', 12)
    // two words: 50 units for the first word + gap, 43 units (no trailing gap) for the second
    expect(sch.total / timing(12).dit).toBeCloseTo(50 + 43, 6)
  })
  it('Farnsworth: ta formula and overall speed', () => {
    const t = timing(18, 5)
    expect(t.gapChar).toBeCloseTo(3 * ((60 * 18 - 37.2 * 5) / (19 * 18 * 5)), 9)
    // sending PARIS repeatedly at 5 effective WPM takes 12 s per word
    const word = 31 * t.dit + 19 * (t.gapChar / 3)
    expect(word).toBeCloseTo(12, 6)
  })
  it('effective speed above character speed is clamped', () => {
    expect(timing(10, 30)).toEqual(timing(10, 10))
  })
  it('duration grows when slower', () => {
    expect(duration('CQ DE', 10)).toBeGreaterThan(duration('CQ DE', 20))
    expect(duration('CQ DE', 20, 8)).toBeGreaterThan(duration('CQ DE', 20))
  })
})

describe('synthesis', () => {
  it('produces audio of the scheduled length', () => {
    const x = synthesize('E', { wpm: 20, freq: 600, sampleRate: 8000 })
    expect(x.length).toBe(Math.ceil(0.06 * 8000))
    expect(Math.max(...x)).toBeGreaterThan(0.5)
  })
  it('encodes a valid WAV header', () => {
    const w = encodeWav(new Float32Array(100), 8000)
    expect(String.fromCharCode(...w.subarray(0, 4))).toBe('RIFF')
    expect(w.length).toBe(244)
  })
})
