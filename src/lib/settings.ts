export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type KeyerMode = 'straight' | 'A' | 'B'

export interface Settings {
  lang: Lang
  theme: Theme
  /** Character speed, WPM. */
  wpm: number
  /** Effective (Farnsworth) speed, WPM. */
  eff: number
  /** Sidetone / drill tone, Hz. */
  freq: number
  volume: number
  keyer: KeyerMode
  keyerWpm: number
}

export const DEFAULTS: Settings = {
  lang: typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : 'en',
  theme: 'auto',
  wpm: 20,
  eff: 12,
  freq: 600,
  volume: 0.6,
  keyer: 'B',
  keyerWpm: 15,
}

const KEY = 'morse-trainer:settings'
const clamp = (x: unknown, lo: number, hi: number, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d)

export function sanitize(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const wpm = clamp(r.wpm, 5, 50, DEFAULTS.wpm)
  return {
    lang: r.lang === 'uk' || r.lang === 'en' ? r.lang : DEFAULTS.lang,
    theme: r.theme === 'light' || r.theme === 'dark' || r.theme === 'auto' ? r.theme : DEFAULTS.theme,
    wpm,
    eff: Math.min(wpm, clamp(r.eff, 2, 50, DEFAULTS.eff)),
    freq: clamp(r.freq, 300, 1200, DEFAULTS.freq),
    volume: clamp(r.volume, 0, 1, DEFAULTS.volume),
    keyer: r.keyer === 'straight' || r.keyer === 'A' || r.keyer === 'B' ? r.keyer : DEFAULTS.keyer,
    keyerWpm: clamp(r.keyerWpm, 5, 40, DEFAULTS.keyerWpm),
  }
}

export function loadSettings(): Settings {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return sanitize(null)
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage full or blocked */
  }
}
