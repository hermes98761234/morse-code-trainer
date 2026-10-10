/** Iambic (Curtis A/B) keyer state machine. Time is advanced explicitly so it can be tested. */
import type { Run } from './decode'

export type Element = 'dit' | 'dah'

export interface KeyerState {
  mode: 'A' | 'B'
  phase: 'idle' | 'on' | 'gap'
  el: Element | null
  last: Element | null
  /** Milliseconds left in the current phase. */
  left: number
  /** The opposite paddle was pressed during the element or gap. */
  memDit: boolean
  memDah: boolean
  /** Both paddles were down together. */
  squeezed: boolean
  /** Silence accumulated while idle. */
  idle: number
}

export function newKeyer(mode: 'A' | 'B'): KeyerState {
  return { mode, phase: 'idle', el: null, last: null, left: 0, memDit: false, memDah: false, squeezed: false, idle: 0 }
}

function pick(d: boolean, h: boolean, last: Element | null): Element {
  if (d && h) return last === 'dit' ? 'dah' : 'dit'
  return d ? 'dit' : 'dah'
}

/**
 * Advances the keyer by `dt` ms with the given paddle states. Returns whether the tone is on at the
 * end and the runs (tone/silence) produced. Runs are emitted when they start, with nominal length.
 */
export function stepKeyer(s: KeyerState, dt: number, dit: boolean, dah: boolean, unit: number): { on: boolean; runs: Run[] } {
  const runs: Run[] = []
  let rem = dt
  const emit = (on: boolean, ms: number) => {
    const last = runs[runs.length - 1]
    if (last && last.on === on) last.ms += ms
    else runs.push({ on, ms })
  }
  const start = (el: Element) => {
    if (s.idle > 0) emit(false, s.idle)
    s.idle = 0
    s.el = el
    s.phase = 'on'
    s.left = el === 'dit' ? unit : 3 * unit
    s.squeezed = dit && dah
    if (el === 'dit') s.memDit = false
    else s.memDah = false
    emit(true, s.left)
  }
  for (let guard = 0; guard < 10000; guard++) {
    if (s.phase === 'idle') {
      if (!dit && !dah) {
        s.idle += rem
        break
      }
      start(pick(dit, dah, s.last))
      continue
    }
    if (s.el === 'dah' && dit) s.memDit = true
    if (s.el === 'dit' && dah) s.memDah = true
    if (dit && dah) s.squeezed = true
    if (rem < s.left) {
      s.left -= rem
      break
    }
    rem -= s.left
    if (s.phase === 'on') {
      s.phase = 'gap'
      s.left = unit
      emit(false, unit)
      s.last = s.el
    } else {
      let d = dit || s.memDit
      let h = dah || s.memDah
      if (s.mode === 'A' && !dit && !dah && s.squeezed) d = h = false
      s.squeezed = false
      if (!d && !h) {
        s.phase = 'idle'
        s.el = null
        s.memDit = s.memDah = false
        s.idle = 0
        continue
      }
      start(pick(d, h, s.last))
    }
  }
  return { on: s.phase === 'on', runs }
}
