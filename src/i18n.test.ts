import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tr, UK } from './i18n'

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sources(p)
    return /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [p] : []
  })
}

describe('i18n', () => {
  it('interpolates placeholders', () => {
    expect(tr('en', '{0}% of {1}', 5, 'x')).toBe('5% of x')
    expect(tr('uk', 'Volume')).toBe('Гучність')
    expect(tr('uk', 'unknown string')).toBe('unknown string')
  })
  it('translates every string used in the UI', () => {
    const used = new Set<string>()
    for (const f of sources('src')) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/\bt\((['"])((?:\\.|(?!\1).)*)\1/g)) used.add(m[2].replace(/\\(.)/g, '$1'))
      for (const m of src.matchAll(/label: (['"])((?:\\.|(?!\1).)*)\1/g)) used.add(m[2])
      for (const m of src.matchAll(/title: (['"])((?:\\.|(?!\1).)*)\1/g)) used.add(m[2])
    }
    const missing = [...used].filter((s) => !(s in UK))
    expect(missing).toEqual([])
    expect(used.size).toBeGreaterThan(60)
  })
  it('keeps placeholders in translations', () => {
    for (const [en, uk] of Object.entries(UK)) {
      const a = (en.match(/\{\d+\}/g) ?? []).sort().join()
      const b = (uk.match(/\{\d+\}/g) ?? []).sort().join()
      expect(b, en).toBe(a)
    }
  })
})
