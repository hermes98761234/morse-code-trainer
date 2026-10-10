import { KOCH_PASS, MAX_KOCH_LEVEL, type DrillKind, type Score } from './drills'

export interface SessionRecord {
  ts: number
  kind: DrillKind
  level: number
  wpm: number
  eff: number
  total: number
  correct: number
}

export interface Progress {
  /** Current Koch level: the number of characters is level + 1. */
  level: number
  sessions: SessionRecord[]
  chars: Record<string, { sent: number; miss: number }>
}

export const EMPTY_PROGRESS: Progress = { level: 1, sessions: [], chars: {} }

const KEY = 'morse-trainer:progress'
const MAX_SESSIONS = 200

export function sanitizeProgress(raw: unknown): Progress {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Progress>
  const level = typeof r.level === 'number' && Number.isFinite(r.level) ? Math.min(MAX_KOCH_LEVEL, Math.max(1, Math.floor(r.level))) : 1
  const sessions = Array.isArray(r.sessions) ? r.sessions.filter((s) => s && typeof s.total === 'number' && typeof s.correct === 'number').slice(-MAX_SESSIONS) : []
  const chars: Progress['chars'] = {}
  if (r.chars && typeof r.chars === 'object')
    for (const [k, v] of Object.entries(r.chars)) if (v && typeof v.sent === 'number' && typeof v.miss === 'number') chars[k] = { sent: v.sent, miss: v.miss }
  return { level, sessions, chars }
}

export function loadProgress(): Progress {
  try {
    return sanitizeProgress(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return sanitizeProgress(null)
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage full or blocked */
  }
}

/** Adds a scored drill to the history and per-character statistics. */
export function recordSession(p: Progress, rec: Omit<SessionRecord, 'total' | 'correct'>, score: Score): Progress {
  const chars = { ...p.chars }
  for (const [c, v] of Object.entries(score.perChar)) {
    const e = chars[c] ?? { sent: 0, miss: 0 }
    chars[c] = { sent: e.sent + v.sent, miss: e.miss + v.miss }
  }
  const sessions = [...p.sessions, { ...rec, total: score.total, correct: score.correct }].slice(-MAX_SESSIONS)
  return { ...p, sessions, chars }
}

/** Should the learner move to the next Koch character after this score? */
export function shouldAdvance(score: Score, kind: DrillKind, level: number): boolean {
  return kind === 'koch' && level < MAX_KOCH_LEVEL && score.total >= 20 && score.accuracy >= KOCH_PASS
}

/** Characters with the highest miss rate, worst first (needs at least `minSent` samples). */
export function weakest(p: Progress, n = 5, minSent = 3): { ch: string; rate: number; sent: number }[] {
  return Object.entries(p.chars)
    .filter(([, v]) => v.sent >= minSent && v.miss > 0)
    .map(([ch, v]) => ({ ch, rate: v.miss / v.sent, sent: v.sent }))
    .sort((a, b) => b.rate - a.rate || b.sent - a.sent)
    .slice(0, n)
}
