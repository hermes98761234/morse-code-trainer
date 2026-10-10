import { useEffect, useMemo, useRef, useState } from 'react'
import { playTones, type Playback } from '../audio'
import { KOCH_ORDER, MAX_KOCH_LEVEL, kochChars, makeDrill, makeRng, scoreCopy, type DrillKind, type Score } from '../lib/drills'
import { duration, schedule } from '../lib/morse'
import { recordSession, shouldAdvance, weakest, type Progress } from '../lib/progress'
import type { Settings } from '../lib/settings'
import type { T } from '../i18n'

interface Props {
  settings: Settings
  progress: Progress
  onProgress: (p: Progress) => void
  t: T
}

const KINDS: { id: DrillKind; label: string }[] = [
  { id: 'koch', label: 'Character groups (Koch)' },
  { id: 'words', label: 'Words' },
  { id: 'callsigns', label: 'Callsigns' },
  { id: 'qso', label: 'QSO exchange' },
  { id: 'custom', label: 'My own text' },
]

const PREFS = 'morse-trainer:drill'

interface Prefs {
  kind: DrillKind
  count: number
  groupSize: number
  custom: string
}

function loadPrefs(): Prefs {
  const d: Prefs = { kind: 'koch', count: 10, groupSize: 5, custom: 'CQ CQ DE N0CALL K' }
  try {
    const r = JSON.parse(localStorage.getItem(PREFS) ?? 'null') as Partial<Prefs> | null
    if (r && KINDS.some((k) => k.id === r.kind)) d.kind = r.kind!
    if (typeof r?.count === 'number') d.count = Math.min(60, Math.max(1, Math.round(r.count)))
    if (typeof r?.groupSize === 'number') d.groupSize = Math.min(10, Math.max(1, Math.round(r.groupSize)))
    if (typeof r?.custom === 'string') d.custom = r.custom.slice(0, 2000)
  } catch {
    /* defaults */
  }
  return d
}

export default function Practice({ settings, progress, onProgress, t }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [sent, setSent] = useState('')
  const [typed, setTyped] = useState('')
  const [score, setScore] = useState<Score | null>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [levelUp, setLevelUp] = useState(false)
  const pb = useRef<Playback | null>(null)
  const seed = useRef<number | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => localStorage.setItem(PREFS, JSON.stringify(prefs)), [prefs])
  useEffect(() => () => pb.current?.stop(), [])

  const level = progress.level
  const chars = useMemo(() => kochChars(level), [level])
  const total = useMemo(() => (sent ? duration(sent, settings.wpm, settings.eff) : 0), [sent, settings.wpm, settings.eff])

  const play = (text: string) => {
    pb.current?.stop()
    const sch = schedule(text, settings.wpm, settings.eff)
    setPlaying(true)
    setPos(0)
    const p = playTones(sch.tones, sch.total, settings.freq, settings.volume, 0.8, () => setPlaying(false))
    pb.current = p
    const tick = () => {
      const x = p.position()
      if (x === null) return
      setPos(Math.max(0, x))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  const start = () => {
    seed.current = ((seed.current ?? Math.floor(Math.random() * 2 ** 31)) * 1103515245 + 12345) >>> 0
    const text = makeDrill({ kind: prefs.kind, level, count: prefs.count, groupSize: prefs.groupSize, custom: prefs.custom }, makeRng(seed.current))
    if (!text) return
    setSent(text)
    setTyped('')
    setScore(null)
    setLevelUp(false)
    play(text)
    area.current?.focus()
  }

  const stop = () => pb.current?.stop()

  const check = () => {
    if (!sent || score) return
    stop()
    const s = scoreCopy(sent, typed)
    setScore(s)
    onProgress(recordSession(progress, { ts: Date.now(), kind: prefs.kind, level, wpm: settings.wpm, eff: settings.eff }, s))
    setLevelUp(shouldAdvance(s, prefs.kind, level))
  }

  const advance = () => {
    onProgress({ ...progress, level: Math.min(MAX_KOCH_LEVEL, level + 1) })
    setLevelUp(false)
  }

  const weak = weakest(progress, 4)
  const setPref = (p: Partial<Prefs>) => setPrefs((x) => ({ ...x, ...p }))
  const koch = prefs.kind === 'koch' || prefs.kind === 'words'

  return (
    <div className="stack">
      <section className="box">
        <h3>{t('Drill')}</h3>
        <div className="grid3">
          <div className="field">
            <label htmlFor="kind">{t('Material')}</label>
            <select id="kind" value={prefs.kind} onChange={(e) => setPref({ kind: e.target.value as DrillKind })}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {t(k.label)}
                </option>
              ))}
            </select>
          </div>
          {prefs.kind !== 'qso' && prefs.kind !== 'custom' && (
            <div className="field">
              <label htmlFor="count">{prefs.kind === 'koch' ? t('Groups') : prefs.kind === 'words' ? t('Words count') : t('Callsigns')}</label>
              <input id="count" type="number" min={1} max={60} value={prefs.count} onChange={(e) => setPref({ count: Math.min(60, Math.max(1, +e.target.value || 1)) })} />
            </div>
          )}
          {prefs.kind === 'koch' && (
            <div className="field">
              <label htmlFor="gs">{t('Group size')}</label>
              <input id="gs" type="number" min={1} max={10} value={prefs.groupSize} onChange={(e) => setPref({ groupSize: Math.min(10, Math.max(1, +e.target.value || 1)) })} />
            </div>
          )}
        </div>
        {prefs.kind === 'custom' && (
          <div className="field">
            <label htmlFor="custom">{t('Text to send (use <AR>, <SK> for prosigns)')}</label>
            <textarea id="custom" rows={2} value={prefs.custom} onChange={(e) => setPref({ custom: e.target.value })} />
          </div>
        )}
        {koch && (
          <div className="koch">
            <div className="row">
              <label htmlFor="level">
                {t('Koch level')}: <b>{level}</b> ({chars.length} {t('characters')})
              </label>
              <input id="level" type="range" min={1} max={MAX_KOCH_LEVEL} value={level} onChange={(e) => onProgress({ ...progress, level: +e.target.value })} />
            </div>
            <div className="chips" aria-label={t('Characters in this lesson')}>
              {KOCH_ORDER.map((c, i) => (
                <span key={c} className={'chip' + (i < chars.length ? ' on' : '') + (i === chars.length - 1 ? ' new' : '')}>
                  {c}
                </span>
              ))}
            </div>
            <p className="hint">{t('Koch method: start with two characters at full speed and add the next one when you copy 90% correctly.')}</p>
          </div>
        )}
        <div className="row">
          <button className="primary" onClick={start}>
            {sent ? t('New drill') : t('Start drill')}
          </button>
          <button onClick={() => (playing ? stop() : play(sent))} disabled={!sent}>
            {playing ? t('Stop') : t('Repeat')}
          </button>
          <span className="hint">
            {settings.wpm} / {settings.eff} WPM · {settings.freq} Hz
            {sent ? ` · ${total.toFixed(1)} s` : ''}
          </span>
        </div>
        {playing && <progress className="bar" max={Math.max(total, 0.1)} value={Math.min(pos, total)} />}
      </section>

      <section className="box">
        <h3>{t('Your copy')}</h3>
        <textarea
          ref={area}
          rows={4}
          className="copy"
          value={typed}
          disabled={!!score}
          placeholder={sent ? t('Type what you hear. Spaces do not matter.') : t('Press "Start drill", then type what you hear.')}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) check()
          }}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="row">
          <button className="primary" onClick={check} disabled={!sent || !!score}>
            {t('Check')}
          </button>
          <span className="hint">Ctrl+Enter</span>
        </div>
        {score && (
          <div className="result" role="status">
            <p className={'verdict ' + (score.accuracy >= 0.9 ? 'ok' : score.accuracy >= 0.7 ? 'warn' : 'err')}>
              {t('{0}% correct ({1} of {2} characters)', Math.round(score.accuracy * 100), score.correct, score.total)}
            </p>
            <div className="align" aria-label={t('Comparison')}>
              {score.alignment.map((a, i) => (
                <span key={i} className={'ch ' + a.mark} title={a.mark === 'ok' ? '' : `${t('sent')}: ${a.sent || '–'} · ${t('typed')}: ${a.typed || '–'}`}>
                  {a.mark === 'extra' ? a.typed : a.sent}
                  {a.mark === 'wrong' && <sub>{a.typed}</sub>}
                </span>
              ))}
            </div>
            <p className="hint">{t('Green: correct. Red: wrong (what you typed below). Strike-through: missed. Orange: extra.')}</p>
            {levelUp && (
              <p className="ok-text">
                {t('Great copy! Add the next character?')} <b>{KOCH_ORDER[level + 1]}</b>{' '}
                <button onClick={advance}>{t('Level up')}</button>
              </p>
            )}
            <button onClick={start}>{t('Next drill')}</button>
          </div>
        )}
      </section>

      {weak.length > 0 && (
        <section className="box">
          <h3>{t('Characters to work on')}</h3>
          <p>
            {weak.map((w) => (
              <span key={w.ch} className="weak">
                <b>{w.ch}</b> {Math.round(w.rate * 100)}%
              </span>
            ))}
          </p>
        </section>
      )}
    </div>
  )
}
