import { describe, expect, it } from 'vitest'
import { decodeRuns, pushRun, type Run } from './decode'
import { newKeyer, stepKeyer } from './keyer'

const U = 60

function drive(mode: 'A' | 'B', plan: { t: number; dit: boolean; dah: boolean }[], total: number): Run[] {
  const s = newKeyer(mode)
  const runs: Run[] = []
  let dit = false
  let dah = false
  let p = 0
  for (let t = 0; t < total; t += 5) {
    while (p < plan.length && plan[p].t <= t) {
      dit = plan[p].dit
      dah = plan[p].dah
      p++
    }
    for (const r of stepKeyer(s, 5, dit, dah, U).runs) pushRun(runs, r.on, r.ms)
  }
  return runs
}

describe('iambic keyer', () => {
  it('sends dots while the dit paddle is held', () => {
    const runs = drive('B', [{ t: 0, dit: true, dah: false }, { t: 600, dit: false, dah: false }], 1000)
    const on = runs.filter((r) => r.on).map((r) => r.ms)
    expect(on.every((x) => x === U)).toBe(true)
    expect(on.length).toBeGreaterThanOrEqual(4)
    expect(runs.filter((r) => !r.on).slice(0, 3).every((r) => r.ms === U)).toBe(true)
  })
  it('alternates when squeezed', () => {
    const runs = drive('B', [{ t: 0, dit: true, dah: true }, { t: 700, dit: false, dah: false }], 1500)
    const on = runs.filter((r) => r.on).map((r) => r.ms)
    expect(on.slice(0, 4)).toEqual([U, 3 * U, U, 3 * U])
  })
  it('squeeze gives C in the decoder', () => {
    const runs = drive('B', [{ t: 0, dit: false, dah: true }, { t: 5, dit: true, dah: true }, { t: 400, dit: false, dah: false }], 2000)
    expect(decodeRuns(runs, { unit: U }).text).toBe('C')
  })
  it('mode B adds one more element after releasing a squeeze, mode A does not', () => {
    const plan = [{ t: 0, dit: true, dah: true }, { t: 20, dit: false, dah: false }]
    expect(drive('B', plan, 1500).filter((r) => r.on).map((r) => r.ms)).toEqual([U, 3 * U])
    expect(drive('A', plan, 1500).filter((r) => r.on).map((r) => r.ms)).toEqual([U])
  })
  it('sends the opposite paddle tapped during an element', () => {
    const plan = [{ t: 0, dit: false, dah: true }, { t: 40, dit: true, dah: true }, { t: 60, dit: true, dah: false }, { t: 100, dit: false, dah: false }]
    const on = drive('B', plan, 2000).filter((r) => r.on).map((r) => r.ms)
    expect(on.slice(0, 2)).toEqual([3 * U, U])
  })
  it('stays silent when idle and reports idle time before the next element', () => {
    const runs = drive('B', [{ t: 500, dit: true, dah: false }, { t: 520, dit: false, dah: false }], 1000)
    expect(runs[0]).toEqual({ on: false, ms: 500 })
    expect(runs[1]).toEqual({ on: true, ms: U })
  })
})
