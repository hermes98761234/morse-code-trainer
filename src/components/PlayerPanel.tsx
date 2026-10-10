import { useEffect, useMemo, useRef, useState } from 'react'
import { playTones, type Playback } from '../audio'
import { encodeWav, schedule, synthesize, toMorseString } from '../lib/morse'
import type { Settings } from '../lib/settings'
import type { T } from '../i18n'

interface Props {
  settings: Settings
  t: T
}

const KEY = 'morse-trainer:player'
const SAMPLES = ['CQ CQ CQ DE UR5ABC UR5ABC K', 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 0123456789', 'SOS SOS SOS', 'TEST <AR>']

export default function PlayerPanel({ settings, t }: Props) {
  const [text, setText] = useState(() => localStorage.getItem(KEY) ?? SAMPLES[0])
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const pb = useRef<Playback | null>(null)
  useEffect(() => localStorage.setItem(KEY, text), [text])
  useEffect(() => () => pb.current?.stop(), [])

  const sch = useMemo(() => schedule(text, settings.wpm, settings.eff), [text, settings.wpm, settings.eff])
  const stop = () => pb.current?.stop()
  const play = () => {
    stop()
    if (sch.tones.length === 0) return
    setPlaying(true)
    const p = playTones(sch.tones, sch.total, settings.freq, settings.volume, 0.2, () => setPlaying(false))
    pb.current = p
    const tick = () => {
      const x = p.position()
      if (x === null) return
      setPos(x)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  const download = () => {
    const sr = 22050
    const pcm = synthesize(text, { wpm: settings.wpm, effectiveWpm: settings.eff, freq: settings.freq, sampleRate: sr, pad: 0.3, amplitude: settings.volume * 0.8 })
    const blob = new Blob([encodeWav(pcm, sr) as BlobPart], { type: 'audio/wav' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'morse.wav'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const current = playing ? sch.tokenTimes.findIndex((x) => pos >= x.start && pos <= x.end + 1e-6) : -1

  return (
    <div className="stack">
      <section className="box">
        <h3>{t('Text to Morse')}</h3>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label={t('Text to Morse')} />
        <div className="row">
          {SAMPLES.map((s) => (
            <button key={s} className="small" onClick={() => setText(s)}>
              {s.length > 18 ? s.slice(0, 16) + '…' : s}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="primary" onClick={playing ? stop : play} disabled={sch.tones.length === 0}>
            {playing ? t('Stop') : t('Play')}
          </button>
          <button onClick={download} disabled={sch.tones.length === 0}>
            {t('Download WAV')}
          </button>
          <span className="hint">
            {settings.wpm} / {settings.eff} WPM · {sch.total.toFixed(1)} s
          </span>
        </div>
      </section>
      <section className="box">
        <h3>{t('Morse')}</h3>
        <div className="tokens">
          {sch.tokens.map((tok, i) =>
            tok.pattern === '' ? (
              <span key={i} className="tok gap" />
            ) : (
              <span key={i} className={'tok' + (i === current ? ' now' : '')}>
                <b>{tok.text}</b>
                <i>{tok.pattern.replace(/\./g, '·').replace(/-/g, '–')}</i>
              </span>
            ),
          )}
        </div>
        <p className="hint">{toMorseString(text)}</p>
      </section>
    </div>
  )
}
