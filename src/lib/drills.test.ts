import { describe, expect, it } from 'vitest'
import { KOCH_ORDER, kochChars, makeDrill, makeRng, normalizeCopy, randomCallsign, randomGroups, randomQso, randomWords, scoreCopy } from './drills'
import { EMPTY_PROGRESS, recordSession, sanitizeProgress, shouldAdvance, weakest } from './progress'
import { sanitize } from './settings'
import { tokenize } from './morse'

describe('koch', () => {
  it('starts with K and M and grows by one', () => {
    expect(kochChars(1)).toEqual(['K', 'M'])
    expect(kochChars(4)).toEqual(['K', 'M', 'U', 'R', 'E'])
    expect(kochChars(999).length).toBe(KOCH_ORDER.length)
    expect(KOCH_ORDER.length).toBe(41)
    expect(new Set(KOCH_ORDER).size).toBe(41)
  })
})

describe('generators', () => {
  it('is deterministic for a seed', () => {
    expect(randomGroups(kochChars(5), 4, 5, makeRng(7))).toBe(randomGroups(kochChars(5), 4, 5, makeRng(7)))
    expect(randomGroups(kochChars(5), 4, 5, makeRng(7))).not.toBe(randomGroups(kochChars(5), 4, 5, makeRng(8)))
  })
  it('groups only use the lesson characters', () => {
    const s = randomGroups(kochChars(3), 20, 5, makeRng(1))
    expect(s.split(' ').length).toBe(20)
    expect([...s.replace(/ /g, '')].every((c) => 'KMUR'.includes(c))).toBe(true)
  })
  it('words use only allowed letters', () => {
    const chars = [...'ESTAIONRHLD']
    const w = randomWords(chars, 30, makeRng(2))
    expect([...w.replace(/ /g, '')].every((c) => chars.includes(c))).toBe(true)
  })
  it('callsigns look like callsigns', () => {
    const rng = makeRng(3)
    for (let i = 0; i < 200; i++) expect(randomCallsign(rng)).toMatch(/^[A-Z0-9]{1,3}\d[A-Z]{1,3}$/)
  })
  it('qso is sendable in full', () => {
    const q = randomQso(makeRng(4))
    expect(q.startsWith('CQ CQ CQ DE')).toBe(true)
    const sent = tokenize(q).map((t) => t.text).join('')
    expect(sent.replace(/ /g, '')).toBe(q.replace(/ /g, ''))
  })
  it('makeDrill covers every kind', () => {
    for (const kind of ['koch', 'words', 'callsigns', 'qso', 'custom'] as const)
      expect(makeDrill({ kind, level: 10, count: 5, groupSize: 5, custom: ' hello ' }, makeRng(1)).length).toBeGreaterThan(0)
    expect(makeDrill({ kind: 'custom', level: 1, count: 1, groupSize: 1, custom: ' hello ' }, makeRng(1))).toBe('HELLO')
  })
})

describe('scoring', () => {
  it('perfect copy', () => {
    const s = scoreCopy('CQ DE K', 'cq de k')
    expect(s.accuracy).toBe(1)
    expect(s.total).toBe(5)
  })
  it('ignores spacing', () => {
    expect(normalizeCopy(' a b\nc ')).toBe('ABC')
    expect(scoreCopy('ABC DEF', 'ABCDEF').accuracy).toBe(1)
  })
  it('one dropped character does not spoil the rest', () => {
    const s = scoreCopy('ABCDEFGH', 'ABCDEGH')
    expect(s.correct).toBe(7)
    expect(s.alignment.filter((a) => a.mark === 'missed').map((a) => a.sent)).toEqual(['F'])
    expect(s.perChar.F).toEqual({ sent: 1, miss: 1 })
  })
  it('counts wrong and extra characters', () => {
    const s = scoreCopy('ABCD', 'ABXDE')
    expect(s.alignment.map((a) => a.mark)).toEqual(['ok', 'ok', 'wrong', 'ok', 'extra'])
    expect(s.accuracy).toBe(0.75)
  })
  it('treats prosigns as a symbol', () => {
    expect(scoreCopy('K <AR>', 'K<AR>').total).toBe(2)
    expect(scoreCopy('K <AR>', 'K<AR>').accuracy).toBe(1)
  })
  it('empty input scores zero', () => {
    expect(scoreCopy('', '').accuracy).toBe(0)
    expect(scoreCopy('AB', '').accuracy).toBe(0)
  })
})

describe('progress and settings', () => {
  it('records sessions and per-char stats', () => {
    const score = scoreCopy('KMKMKM', 'KMKMKK')
    const p = recordSession(EMPTY_PROGRESS, { ts: 1, kind: 'koch', level: 1, wpm: 20, eff: 12 }, score)
    expect(p.sessions[0].correct).toBe(5)
    expect(p.chars.M).toEqual({ sent: 3, miss: 1 })
    expect(weakest(p, 3, 1)[0].ch).toBe('M')
    expect(EMPTY_PROGRESS.sessions.length).toBe(0)
  })
  it('advances only on a long enough, accurate Koch drill', () => {
    const long = 'KM'.repeat(15)
    expect(shouldAdvance(scoreCopy(long, long), 'koch', 1)).toBe(true)
    expect(shouldAdvance(scoreCopy(long, 'K'), 'koch', 1)).toBe(false)
    expect(shouldAdvance(scoreCopy(long, long), 'words', 1)).toBe(false)
    expect(shouldAdvance(scoreCopy('KM', 'KM'), 'koch', 1)).toBe(false)
  })
  it('sanitizes stored data', () => {
    expect(sanitizeProgress({ level: 'x', sessions: 5 }).level).toBe(1)
    expect(sanitizeProgress({ level: 9999 }).level).toBe(40)
    const s = sanitize({ wpm: 5, eff: 40, freq: 99999, theme: 'neon' })
    expect(s.eff).toBe(5)
    expect(s.freq).toBe(1200)
    expect(s.theme).toBe('auto')
  })
})
