/** International Morse code table, timing (PARIS, Farnsworth), scheduling and audio synthesis. */

export const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '-': '-....-', _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.',
}

/** Prosigns, written as <AR> in text and sent as one unbroken character. */
export const PROSIGNS: Record<string, string> = {
  AR: '.-.-.', SK: '...-.-', BT: '-...-', KN: '-.--.', AS: '.-...', SOS: '...---...', BK: '-...-.-', CT: '-.-.-',
}

const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([c, p]) => [p, c]))
const REVERSE_PRO: Record<string, string> = Object.fromEntries(Object.entries(PROSIGNS).map(([c, p]) => [p, c]))

/** Pattern of dots and dashes for one character or prosign name; undefined when unknown. */
export function patternFor(ch: string): string | undefined {
  const u = ch.toUpperCase()
  return MORSE[u] ?? PROSIGNS[u]
}

/** Dots and dashes back to a character. Prosigns come back as `<AR>`. */
export function charFor(pattern: string): string | undefined {
  return REVERSE[pattern] ?? (REVERSE_PRO[pattern] ? `<${REVERSE_PRO[pattern]}>` : undefined)
}

export interface Token {
  /** Text shown for this token ("A", "<AR>"), or " " for a word gap. */
  text: string
  pattern: string
  /** Index of the first source character in the original text. */
  index: number
}

/** Splits text into sendable tokens. Unknown characters are skipped; runs of whitespace become one word gap. */
export function tokenize(text: string): Token[] {
  const out: Token[] = []
  const s = text.toUpperCase()
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      while (i < s.length && /\s/.test(s[i])) i++
      if (out.length > 0 && out[out.length - 1].pattern !== '') out.push({ text: ' ', pattern: '', index: i - 1 })
      continue
    }
    if (c === '<') {
      const end = s.indexOf('>', i)
      if (end > i) {
        const name = s.slice(i + 1, end)
        if (PROSIGNS[name]) {
          out.push({ text: `<${name}>`, pattern: PROSIGNS[name], index: i })
          i = end + 1
          continue
        }
      }
    }
    if (MORSE[c]) out.push({ text: c, pattern: MORSE[c], index: i })
    i++
  }
  while (out.length > 0 && out[out.length - 1].pattern === '') out.pop()
  return out
}

/** Text to dots/dashes: characters separated by a space, words by " / ". */
export function toMorseString(text: string): string {
  const words: string[][] = [[]]
  for (const t of tokenize(text)) {
    if (t.pattern === '') words.push([])
    else words[words.length - 1].push(t.pattern)
  }
  return words.map((w) => w.join(' ')).join(' / ')
}

/** Dots/dashes (characters split by spaces, words by "/") back to text. Unknown patterns become "?". */
export function fromMorseString(code: string): string {
  return code
    .trim()
    .split(/\s*\/\s*|\s{3,}/)
    .map((w) => w.split(/\s+/).filter(Boolean).map((p) => charFor(p) ?? '?').join(''))
    .join(' ')
}

export interface Timing {
  /** Dot length in seconds. */
  dit: number
  dah: number
  /** Gap between elements inside a character. */
  gapElement: number
  gapChar: number
  gapWord: number
}

/**
 * PARIS timing. `wpm` is the character speed. `effectiveWpm` (Farnsworth) stretches only the gaps
 * between characters and words: ta = (60c - 37.2s) / (19cs), gaps are 3·ta and 7·ta.
 */
export function timing(wpm: number, effectiveWpm: number = wpm): Timing {
  const c = Math.max(1, wpm)
  const s = Math.min(Math.max(1, effectiveWpm), c)
  const dit = 1.2 / c
  const ta = s === c ? dit : (60 * c - 37.2 * s) / (19 * c * s)
  return { dit, dah: 3 * dit, gapElement: dit, gapChar: 3 * ta, gapWord: 7 * ta }
}

export interface Tone {
  /** Start time and duration in seconds. */
  start: number
  dur: number
  /** Index of the token this tone belongs to. */
  token: number
}

export interface Schedule {
  tones: Tone[]
  tokens: Token[]
  /** Start/end time of each token (words gaps included). */
  tokenTimes: { start: number; end: number }[]
  total: number
}

/** Lays out text on a timeline. */
export function schedule(text: string, wpm: number, effectiveWpm: number = wpm): Schedule {
  const tm = timing(wpm, effectiveWpm)
  const tokens = tokenize(text)
  const tones: Tone[] = []
  const tokenTimes: { start: number; end: number }[] = []
  let t = 0
  tokens.forEach((tok, ti) => {
    if (tok.pattern === '') {
      // A word gap replaces the character gap that already follows the previous token.
      tokenTimes.push({ start: t, end: t + tm.gapWord - tm.gapChar })
      t += tm.gapWord - tm.gapChar
      return
    }
    const start = t
    for (let i = 0; i < tok.pattern.length; i++) {
      const d = tok.pattern[i] === '.' ? tm.dit : tm.dah
      tones.push({ start: t, dur: d, token: ti })
      t += d
      if (i < tok.pattern.length - 1) t += tm.gapElement
    }
    tokenTimes.push({ start, end: t })
    if (ti < tokens.length - 1) t += tm.gapChar
  })
  return { tones, tokens, tokenTimes, total: t }
}

/** Duration in seconds of the whole message. */
export function duration(text: string, wpm: number, effectiveWpm: number = wpm): number {
  return schedule(text, wpm, effectiveWpm).total
}

export interface SynthOptions {
  wpm: number
  effectiveWpm?: number
  freq: number
  sampleRate: number
  /** Linear rise/fall time in seconds, avoids key clicks. */
  rise?: number
  amplitude?: number
  /** Silence before and after, seconds. */
  pad?: number
}

/** Renders Morse as mono PCM samples. */
export function synthesize(text: string, o: SynthOptions): Float32Array {
  const sch = schedule(text, o.wpm, o.effectiveWpm ?? o.wpm)
  const pad = o.pad ?? 0
  const rise = o.rise ?? 0.005
  const amp = o.amplitude ?? 0.8
  const n = Math.ceil((sch.total + 2 * pad) * o.sampleRate)
  const out = new Float32Array(n)
  const w = (2 * Math.PI * o.freq) / o.sampleRate
  for (const tone of sch.tones) {
    const a = Math.round((tone.start + pad) * o.sampleRate)
    const b = Math.min(n, Math.round((tone.start + tone.dur + pad) * o.sampleRate))
    for (let i = a; i < b; i++) {
      const t = (i - a) / o.sampleRate
      const left = (b - i) / o.sampleRate
      const env = Math.min(1, t / rise, left / rise)
      out[i] = amp * env * Math.sin(w * i)
    }
  }
  return out
}

/** 16-bit mono WAV file bytes. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true))
  return new Uint8Array(buf)
}
