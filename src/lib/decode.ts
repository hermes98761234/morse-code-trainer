/** Turning tone/silence runs, or microphone audio, back into text. */
import { charFor } from './morse'

export interface Run {
  on: boolean
  /** Milliseconds. */
  ms: number
}

/** Appends a run, merging with the previous one of the same kind. */
export function pushRun(runs: Run[], on: boolean, ms: number): void {
  if (ms <= 0) return
  const last = runs[runs.length - 1]
  if (last && last.on === on) last.ms += ms
  else runs.push({ on, ms })
}

/**
 * Signal amplitude (a sine of amplitude A gives ≈ A²) at one frequency, by the Goertzel algorithm.
 * A Hann window keeps leakage from nearby tones low.
 */
export function goertzelPower(samples: ArrayLike<number>, sampleRate: number, freq: number): number {
  const n = samples.length
  if (n === 0) return 0
  const k = (2 * Math.PI * freq) / sampleRate
  const coeff = 2 * Math.cos(k)
  let s1 = 0
  let s2 = 0
  let wsum = 0
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1 || 1))
    wsum += w
    const s = w * samples[i] + coeff * s1 - s2
    s2 = s1
    s1 = s
  }
  const re = s1 - s2 * Math.cos(k)
  const im = s2 * Math.sin(k)
  const mag = (2 * Math.sqrt(re * re + im * im)) / wsum
  return mag * mag
}

/** Strongest frequency in [lo, hi] (Hz), scanned in `step` Hz increments. */
export function findTone(samples: ArrayLike<number>, sampleRate: number, lo = 300, hi = 1200, step = 10): number {
  let best = lo
  let bp = -1
  for (let f = lo; f <= hi; f += step) {
    const p = goertzelPower(samples, sampleRate, f)
    if (p > bp) {
      bp = p
      best = f
    }
  }
  return best
}

/** Power of the tone in consecutive blocks of `block` samples. */
export function envelope(samples: Float32Array, sampleRate: number, freq: number, block: number): number[] {
  const out: number[] = []
  for (let i = 0; i + block <= samples.length; i += block) out.push(goertzelPower(samples.subarray(i, i + block), sampleRate, freq))
  return out
}

/**
 * Turns a stream of power readings into runs, with a peak that decays slowly and hysteresis
 * so that fading or noise does not chatter.
 */
export class ToneTracker {
  runs: Run[] = []
  on = false
  peak = 0
  /** Average power while no tone is present. */
  floor = 0
  private age = 0
  private minPeak: number
  private decayMs: number
  /** `minPeak`: powers below this (amplitude 0.01 squared) are never a tone. */
  constructor(minPeak = 1e-4, decayMs = 5000) {
    this.minPeak = minPeak
    this.decayMs = decayMs
  }

  push(power: number, ms: number): boolean {
    this.peak = Math.max(power, this.peak * Math.exp(-ms / this.decayMs))
    const warm = this.age < 100
    this.age += ms
    const peak = Math.max(this.peak, this.minPeak)
    if (this.on) {
      if (power < peak * 0.2) this.on = false
    } else if (!warm && power > this.minPeak && power > peak * 0.45 && power > 6 * this.floor) this.on = true
    if (!this.on) {
      const tau = warm ? 40 : 600
      this.floor = this.age <= ms ? power : this.floor + (power - this.floor) * (1 - Math.exp(-ms / tau))
    }
    pushRun(this.runs, this.on, ms)
    return this.on
  }

  /** Keeps only the last `ms` milliseconds of history. */
  trim(ms: number): void {
    let total = this.runs.reduce((a, r) => a + r.ms, 0)
    while (this.runs.length > 2 && total - this.runs[0].ms > ms) total -= this.runs.shift()!.ms
  }
}

export interface DecodeOptions {
  /** Known dot length in ms. Otherwise estimated from the runs. */
  unit?: number
  /** Dot length to assume when the runs alone cannot tell (one lone element). */
  fallbackUnit?: number
}

/** Estimated dot length (ms) from the tone durations: 1 or 2 clusters (dots and dashes). */
export function estimateUnit(onMs: number[], fallbackUnit?: number): number | undefined {
  const d = onMs.filter((x) => x > 0).sort((a, b) => a - b)
  if (d.length === 0) return fallbackUnit
  let lo = d[0]
  let hi = d[d.length - 1]
  if (hi / lo < 2) {
    // Only one kind of element: dots or dashes.
    const mean = d.reduce((a, b) => a + b, 0) / d.length
    if (fallbackUnit === undefined) return mean
    return Math.abs(Math.log(mean / fallbackUnit)) < Math.abs(Math.log(mean / (3 * fallbackUnit))) ? mean : mean / 3
  }
  for (let it = 0; it < 20; it++) {
    const mid = Math.sqrt(lo * hi)
    const a = d.filter((x) => x < mid)
    const b = d.filter((x) => x >= mid)
    if (a.length === 0 || b.length === 0) break
    lo = a.reduce((s, x) => s + x, 0) / a.length
    hi = b.reduce((s, x) => s + x, 0) / b.length
  }
  return (lo + hi / 3) / 2
}

export interface Decoded {
  text: string
  /** Estimated dot length in ms (undefined if nothing to go on). */
  unit?: number
  wpm?: number
}

/** Decodes tone/silence runs to text, adapting to the sender's speed. */
export function decodeRuns(input: Run[], opts: DecodeOptions = {}): Decoded {
  // Drop blips and bridge dropouts that are too short to be real, judging by the rough unit.
  const rough = opts.unit ?? estimateUnit(input.filter((r) => r.on && r.ms >= 12).map((r) => r.ms), opts.fallbackUnit)
  if (rough === undefined) return { text: '' }
  const clean: Run[] = []
  for (const r of input) {
    if (r.on && r.ms < Math.max(10, rough * 0.35)) pushRun(clean, false, r.ms)
    else pushRun(clean, r.on, r.ms)
  }
  for (let i = 1; i < clean.length - 1; i++) {
    if (!clean[i].on && clean[i].ms < Math.max(8, rough * 0.3) && clean[i - 1].on && clean[i + 1].on) {
      clean[i - 1].ms += clean[i].ms + clean[i + 1].ms
      clean.splice(i, 2)
      i--
    }
  }
  const unit = opts.unit ?? estimateUnit(clean.filter((r) => r.on).map((r) => r.ms), opts.fallbackUnit) ?? rough

  const gaps = clean.filter((r, i) => !r.on && i > 0 && i < clean.length - 1 && r.ms >= 2 * unit).map((r) => r.ms)
  let wordThr = 5 * unit
  if (gaps.length > 1) {
    const mn = Math.min(...gaps)
    const mx = Math.max(...gaps)
    if (mx / mn >= 1.8) wordThr = Math.sqrt(mn * mx)
  }

  let text = ''
  let cur = ''
  const flush = () => {
    if (cur) text += charFor(cur) ?? '?'
    cur = ''
  }
  clean.forEach((r, i) => {
    if (r.on) cur += r.ms < 2 * unit ? '.' : '-'
    else if (i > 0 && i < clean.length - 1) {
      if (r.ms >= wordThr) {
        flush()
        text += ' '
      } else if (r.ms >= 2 * unit) flush()
    }
  })
  flush()
  return { text, unit, wpm: 1200 / unit }
}
