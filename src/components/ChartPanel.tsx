import { useEffect, useRef } from 'react'
import { playTones, type Playback } from '../audio'
import { KOCH_ORDER } from '../lib/drills'
import { MORSE, PROSIGNS, schedule } from '../lib/morse'
import type { Settings } from '../lib/settings'
import type { T } from '../i18n'

const GROUPS: { title: string; chars: string[] }[] = [
  { title: 'Letters', chars: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] },
  { title: 'Numbers', chars: [...'0123456789'] },
  { title: 'Punctuation', chars: [...'.,?\'!/()&:;=-_"$@'] },
]

export default function ChartPanel({ settings, t }: { settings: Settings; t: T }) {
  const pb = useRef<Playback | null>(null)
  useEffect(() => () => pb.current?.stop(), [])
  const play = (text: string) => {
    pb.current?.stop()
    const s = schedule(text, settings.wpm, settings.eff)
    pb.current = playTones(s.tones, s.total, settings.freq, settings.volume, 0.05, () => {})
  }
  const dots = (p: string) => p.replace(/\./g, '·').replace(/-/g, '–')
  return (
    <div className="stack">
      {GROUPS.map((g) => (
        <section className="box" key={g.title}>
          <h3>{t(g.title)}</h3>
          <div className="chart">
            {g.chars.map((c) => (
              <button key={c} className="cell" onClick={() => play(c)} title={`${c} ${MORSE[c]}`}>
                <b>{c}</b>
                <span>{dots(MORSE[c])}</span>
                <small>{KOCH_ORDER.includes(c) ? KOCH_ORDER.indexOf(c) + 1 : ''}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
      <section className="box">
        <h3>{t('Prosigns')}</h3>
        <div className="chart">
          {Object.entries(PROSIGNS).map(([n, p]) => (
            <button key={n} className="cell" onClick={() => play(`<${n}>`)} title={n}>
              <b>{n}</b>
              <span>{dots(p)}</span>
            </button>
          ))}
        </div>
        <p className="hint">{t('Click a character to hear it. The small number is its place in the Koch order.')}</p>
      </section>
    </div>
  )
}
