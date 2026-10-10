/** Web Audio helpers: scheduled playback and a live sidetone. */
import type { Tone } from './lib/morse'

let ctx: AudioContext | null = null

export function audioContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

const RISE = 0.005

export interface Playback {
  stop: () => void
  /** Seconds since the first tone's origin, or null once finished. */
  position: () => number | null
}

/** Plays tones on a timeline that starts `lead` seconds from now. */
export function playTones(tones: Tone[], total: number, freq: number, volume: number, lead: number, onEnd: () => void): Playback {
  const ac = audioContext()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.frequency.value = freq
  gain.gain.value = 0
  osc.connect(gain).connect(ac.destination)
  const t0 = ac.currentTime + lead
  const v = Math.max(0.0001, volume) * 0.5
  for (const t of tones) {
    const a = t0 + t.start
    const b = a + t.dur
    const r = Math.min(RISE, t.dur / 2)
    gain.gain.setValueAtTime(0, a)
    gain.gain.linearRampToValueAtTime(v, a + r)
    gain.gain.setValueAtTime(v, b - r)
    gain.gain.linearRampToValueAtTime(0, b)
  }
  osc.start(t0 - lead)
  const end = t0 + total + 0.05
  osc.stop(end)
  let done = false
  const finish = () => {
    if (done) return
    done = true
    osc.disconnect()
    gain.disconnect()
    onEnd()
  }
  osc.onended = finish
  return {
    stop: () => {
      if (done) return
      gain.gain.cancelScheduledValues(ac.currentTime)
      gain.gain.setValueAtTime(0, ac.currentTime)
      try {
        osc.stop()
      } catch {
        /* already stopped */
      }
      finish()
    },
    position: () => (done ? null : ac.currentTime - t0),
  }
}

/** A key-down tone with short ramps. */
export class Sidetone {
  private osc: OscillatorNode | null = null
  private gain: GainNode | null = null
  freq: number
  volume: number
  constructor(freq: number, volume: number) {
    this.freq = freq
    this.volume = volume
  }

  private ensure(): void {
    if (this.osc) return
    const ac = audioContext()
    this.osc = ac.createOscillator()
    this.gain = ac.createGain()
    this.gain.gain.value = 0
    this.osc.connect(this.gain).connect(ac.destination)
    this.osc.start()
  }

  set(on: boolean): void {
    this.ensure()
    const ac = audioContext()
    const g = this.gain!.gain
    this.osc!.frequency.value = this.freq
    g.cancelScheduledValues(ac.currentTime)
    g.setValueAtTime(g.value, ac.currentTime)
    g.linearRampToValueAtTime(on ? Math.max(0.0001, this.volume) * 0.5 : 0, ac.currentTime + RISE)
  }

  dispose(): void {
    if (!this.osc) return
    this.osc.stop()
    this.osc.disconnect()
    this.gain!.disconnect()
    this.osc = null
    this.gain = null
  }
}
