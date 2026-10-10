import { useEffect, useMemo, useRef, useState } from 'react'
import { Sidetone } from '../audio'
import { decodeRuns, pushRun, type Run } from '../lib/decode'
import { newKeyer, stepKeyer } from '../lib/keyer'
import { toMorseString } from '../lib/morse'
import type { Settings } from '../lib/settings'
import type { T } from '../i18n'

interface Props {
  settings: Settings
  onSettings: (s: Settings) => void
  t: T
}

const TICK = 4

export default function KeyerPanel({ settings, onSettings, t }: Props) {
  const [runs, setRuns] = useState<Run[]>([])
  const [live, setLive] = useState(false)
  const [target, setTarget] = useState('CQ DE TEST')
  const down = useRef({ dit: false, dah: false, ditTap: false, dahTap: false, straight: false })
  const rec = useRef<{ runs: Run[]; lastChange: number; on: boolean }>({ runs: [], lastChange: 0, on: false })
  const tone = useRef<Sidetone | null>(null)
  const keyer = useRef(newKeyer('B'))
  const straight = settings.keyer === 'straight'
  const unit = 1200 / settings.keyerWpm

  // Tone object follows settings.
  useEffect(() => {
    tone.current ??= new Sidetone(settings.freq, settings.volume)
    tone.current.freq = settings.freq
    tone.current.volume = settings.volume
  }, [settings.freq, settings.volume])
  useEffect(() => () => tone.current?.dispose(), [])

  const press = (k: 'dit' | 'dah' | 'straight', isDown: boolean) => {
    const d = down.current
    d[k] = isDown
    if (isDown && k === 'dit') d.ditTap = true
    if (isDown && k === 'dah') d.dahTap = true
  }

  // Engine: runs in small time steps while this panel is mounted.
  useEffect(() => {
    keyer.current = newKeyer(settings.keyer === 'A' ? 'A' : 'B')
    let last = performance.now()
    let wasOn = false
    let lastLen = -1
    let pending = false
    const publish = () => {
      if (pending) return
      pending = true
      setTimeout(() => {
        pending = false
        setRuns(rec.current.runs.map((x) => ({ ...x })))
        setLive(rec.current.on)
      }, 60)
    }
    const id = setInterval(() => {
      const now = performance.now()
      const dt = now - last
      last = now
      const d = down.current
      let on: boolean
      const r = rec.current
      if (straight) {
        on = d.straight
        if (on !== r.on) {
          pushRun(r.runs, r.on, now - r.lastChange)
          r.lastChange = now
          r.on = on
        }
      } else {
        const out = stepKeyer(keyer.current, dt, d.dit || d.ditTap, d.dah || d.dahTap, unit)
        d.ditTap = d.dahTap = false
        on = out.on
        for (const x of out.runs) pushRun(r.runs, x.on, x.ms)
      }
      if (on !== wasOn) {
        tone.current?.set(on)
        wasOn = on
      }
      if (r.runs.length !== lastLen) {
        lastLen = r.runs.length
        publish()
      }
    }, TICK)
    return () => {
      clearInterval(id)
      tone.current?.set(false)
    }
  }, [settings.keyer, straight, unit])

  const clear = () => {
    rec.current = { runs: [], lastChange: performance.now(), on: false }
    setRuns([])
  }

  // Keyboard.
  useEffect(() => {
    const map = (e: KeyboardEvent): 'dit' | 'dah' | 'straight' | null => {
      if (straight) return e.code === 'Space' || e.code === 'Enter' ? 'straight' : null
      if (e.code === 'ArrowLeft' || e.code === 'KeyZ' || e.code === 'BracketLeft') return 'dit'
      if (e.code === 'ArrowRight' || e.code === 'KeyX' || e.code === 'BracketRight') return 'dah'
      return null
    }
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLInputElement && e.target.type === 'text')
    const dn = (e: KeyboardEvent) => {
      const k = map(e)
      if (!k || typing(e)) return
      e.preventDefault()
      if (e.repeat) return
      press(k, true)
    }
    const up = (e: KeyboardEvent) => {
      const k = map(e)
      if (!k || typing(e)) return
      e.preventDefault()
      press(k, false)
    }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', dn)
      window.removeEventListener('keyup', up)
    }
  }, [straight])

  const pad = (k: 'dit' | 'dah' | 'straight') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      press(k, true)
    },
    onPointerUp: () => press(k, false),
    onPointerCancel: () => press(k, false),
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  })

  const decoded = useMemo(() => {
    return decodeRuns(runs, straight ? { fallbackUnit: unit } : { unit })
  }, [runs, straight, unit])

  const code = useMemo(() => {
    // Dots and dashes of what was keyed, for display.
    const u = decoded.unit ?? unit
    let s = ''
    runs.forEach((r, i) => {
      if (r.on) s += r.ms < 2 * u ? '.' : '-'
      else if (i > 0 && i < runs.length - 1) s += r.ms >= 5 * u ? ' / ' : r.ms >= 2 * u ? ' ' : ''
    })
    return s
  }, [runs, decoded.unit, unit])

  const want = toMorseString(target)
  const matches = decoded.text.replace(/\s+/g, '') === target.toUpperCase().replace(/\s+/g, '')

  return (
    <div className="stack">
      <section className="box">
        <h3>{t('Keyer')}</h3>
        <div className="grid3">
          <div className="field">
            <label htmlFor="km">{t('Key type')}</label>
            <select id="km" value={settings.keyer} onChange={(e) => onSettings({ ...settings, keyer: e.target.value as Settings['keyer'] })}>
              <option value="straight">{t('Straight key')}</option>
              <option value="A">{t('Iambic A')}</option>
              <option value="B">{t('Iambic B')}</option>
            </select>
          </div>
          {!straight && (
            <div className="field">
              <label htmlFor="kw">{t('Keyer speed')}: {settings.keyerWpm} WPM</label>
              <input id="kw" type="range" min={5} max={40} value={settings.keyerWpm} onChange={(e) => onSettings({ ...settings, keyerWpm: +e.target.value })} />
            </div>
          )}
        </div>
        <p className="hint">
          {straight
            ? t('Straight key: hold Space (or press the big button) for the tone. Your speed is detected automatically.')
            : t('Paddles: Left arrow / Z = dot, Right arrow / X = dash, or use the buttons. Hold both to alternate.')}
        </p>
        <div className={'keys' + (straight ? ' one' : '')}>
          {straight ? (
            <button className={'pad big' + (live ? ' live' : '')} {...pad('straight')} aria-label={t('Key')}>
              {t('Key')}
            </button>
          ) : (
            <>
              <button className="pad big" {...pad('dit')} aria-label={t('Dot paddle')}>
                ·
              </button>
              <button className="pad big" {...pad('dah')} aria-label={t('Dash paddle')}>
                –
              </button>
            </>
          )}
        </div>
      </section>
      <section className="box">
        <h3>{t('Decoded')}</h3>
        <div className="screen" aria-live="polite">
          {decoded.text || <span className="muted">{t('Start keying…')}</span>}
        </div>
        <div className="code">{code}</div>
        <div className="row">
          <button onClick={clear}>{t('Clear')}</button>
          {decoded.wpm !== undefined && (
            <span className="hint">
              {t('Detected speed')}: {decoded.wpm.toFixed(0)} WPM
            </span>
          )}
        </div>
      </section>
      <section className="box">
        <h3>{t('Send this')}</h3>
        <div className="field">
          <label htmlFor="tg">{t('Target text')}</label>
          <input id="tg" value={target} onChange={(e) => setTarget(e.target.value.toUpperCase())} />
        </div>
        <div className="code">{want}</div>
        <p className={matches ? 'ok-text' : 'hint'}>{matches ? t('Perfect, that matches.') : t('Key the text above; this turns green when it matches.')}</p>
      </section>
    </div>
  )
}
