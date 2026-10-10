import { describe, expect, it } from 'vitest'
import { decodeRuns, envelope, estimateUnit, findTone, goertzelPower, ToneTracker, type Run } from './decode'
import { schedule, synthesize } from './morse'

function runsFor(text: string, wpm: number, eff = wpm): Run[] {
  const s = schedule(text, wpm, eff)
  const runs: Run[] = []
  let t = 0
  for (const tone of s.tones) {
    if (tone.start > t) runs.push({ on: false, ms: (tone.start - t) * 1000 })
    runs.push({ on: true, ms: tone.dur * 1000 })
    t = tone.start + tone.dur
  }
  return runs
}

describe('goertzel', () => {
  it('measures the amplitude of a sine', () => {
    const fs = 8000
    const x = Float32Array.from({ length: 800 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 600 * i) / fs))
    expect(goertzelPower(x, fs, 600)).toBeCloseTo(0.25, 1)
    expect(goertzelPower(x, fs, 1200)).toBeLessThan(0.005)
  })
  it('finds the tone frequency', () => {
    const fs = 8000
    const x = Float32Array.from({ length: 2048 }, (_, i) => Math.sin((2 * Math.PI * 740 * i) / fs))
    expect(Math.abs(findTone(x, fs) - 740)).toBeLessThanOrEqual(10)
  })
})

describe('decodeRuns', () => {
  for (const wpm of [8, 15, 25, 35]) {
    it(`decodes text at ${wpm} WPM without being told the speed`, () => {
      const text = 'CQ CQ DE UR5ABC 599 K'
      const d = decodeRuns(runsFor(text, wpm))
      expect(d.text).toBe(text)
      expect(d.wpm).toBeCloseTo(wpm, 0)
    })
  }
  it('handles Farnsworth spacing', () => {
    const text = 'THE QUICK BROWN FOX'
    expect(decodeRuns(runsFor(text, 20, 8)).text).toBe(text)
  })
  it('decodes prosigns and punctuation', () => {
    expect(decodeRuns(runsFor('TEST <AR> 73?', 18)).text).toBe('TEST <AR> 73?')
  })
  it('uses a known unit', () => {
    expect(decodeRuns(runsFor('E', 20), { unit: 60 }).text).toBe('E')
    expect(decodeRuns(runsFor('T', 20), { unit: 60 }).text).toBe('T')
  })
  it('tells a lone dash from a lone dot with a fallback unit', () => {
    expect(decodeRuns([{ on: true, ms: 180 }], { fallbackUnit: 60 }).text).toBe('T')
    expect(decodeRuns([{ on: true, ms: 60 }], { fallbackUnit: 60 }).text).toBe('E')
  })
  it('ignores short blips and bridges short dropouts', () => {
    const runs = runsFor('NO', 20)
    runs.splice(2, 0, { on: true, ms: 4 }, { on: false, ms: 20 })
    expect(decodeRuns(runs).text).toBe('NO')
    const dropout: Run[] = [{ on: true, ms: 90 }, { on: false, ms: 5 }, { on: true, ms: 90 }, { on: false, ms: 60 }, { on: true, ms: 60 }]
    expect(decodeRuns(dropout, { unit: 60 }).text).toBe('N')
  })
  it('estimates the unit from dots and dashes', () => {
    expect(estimateUnit([60, 180, 60, 60, 180], undefined)).toBeCloseTo(60, 3)
    expect(estimateUnit([], 50)).toBe(50)
  })
})

describe('audio pipeline', () => {
  it('decodes synthesized audio with noise through Goertzel and the tracker', () => {
    const fs = 8000
    const text = 'CQ TEST DE W1AW'
    const sig = synthesize(text, { wpm: 20, freq: 650, sampleRate: fs, pad: 0.3, amplitude: 0.5 })
    let seed = 1
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) - 0.5
    for (let i = 0; i < sig.length; i++) sig[i] += 0.1 * rnd()
    const block = 64 // 8 ms
    const env = envelope(sig, fs, 650, block)
    const tr = new ToneTracker()
    for (const p of env) tr.push(p, (block / fs) * 1000)
    expect(decodeRuns(tr.runs).text).toBe(text)
  })
  it('never detects a tone in silence', () => {
    const tr = new ToneTracker()
    for (let i = 0; i < 100; i++) tr.push(1e-8, 10)
    expect(tr.runs.every((r) => !r.on)).toBe(true)
  })
})
