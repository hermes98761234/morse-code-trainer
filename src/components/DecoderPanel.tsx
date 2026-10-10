import { useEffect, useMemo, useRef, useState } from 'react'
import { audioContext } from '../audio'
import { decodeRuns, findTone, goertzelPower, ToneTracker, type Run } from '../lib/decode'
import type { Settings } from '../lib/settings'
import type { T } from '../i18n'

interface Props {
  settings: Settings
  t: T
}

const HISTORY_MS = 90000

export default function DecoderPanel({ settings, t }: Props) {
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  const [runs, setRuns] = useState<Run[]>([])
  const [level, setLevel] = useState(0)
  const [tone, setTone] = useState(false)
  const [freq, setFreq] = useState(settings.freq)
  const freqRef = useRef(freq)
  useEffect(() => {
    freqRef.current = freq
  }, [freq])
  const stopRef = useRef<(() => void) | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const tracker = useRef(new ToneTracker())

  const stop = () => {
    stopRef.current?.()
    stopRef.current = null
    setActive(false)
  }
  useEffect(() => () => stopRef.current?.(), [])

  const start = async () => {
    setError('')
    try {
      const ac = audioContext()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      const src = ac.createMediaStreamSource(stream)
      const an = ac.createAnalyser()
      an.fftSize = 512
      src.connect(an)
      analyser.current = an
      tracker.current = new ToneTracker()
      const buf = new Float32Array(an.fftSize)
      let last = performance.now()
      let n = 0
      const id = setInterval(() => {
        const now = performance.now()
        const dt = now - last
        last = now
        an.getFloatTimeDomainData(buf)
        const p = goertzelPower(buf, ac.sampleRate, freqRef.current)
        const on = tracker.current.push(p, dt)
        tracker.current.trim(HISTORY_MS)
        setLevel(Math.min(1, Math.sqrt(p) * 4))
        setTone(on)
        if (++n % 6 === 0) setRuns(tracker.current.runs.map((r) => ({ ...r })))
      }, 6)
      stopRef.current = () => {
        clearInterval(id)
        src.disconnect()
        stream.getTracks().forEach((tr) => tr.stop())
      }
      setActive(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const detect = () => {
    const an = analyser.current
    if (!an) return
    const big = new Float32Array(2048)
    // The analyser only keeps fftSize samples; widen it briefly for a better frequency estimate.
    const old = an.fftSize
    an.fftSize = 2048
    setTimeout(() => {
      an.getFloatTimeDomainData(big)
      const f = findTone(big, an.context.sampleRate, 300, 1200, 5)
      an.fftSize = old
      setFreq(f)
    }, 120)
  }

  const decoded = useMemo(() => decodeRuns(runs, { fallbackUnit: 1200 / settings.wpm }), [runs, settings.wpm])

  return (
    <div className="stack">
      <section className="box">
        <h3>{t('Decode from microphone')}</h3>
        <p className="hint">{t('Hold your phone or radio speaker near the microphone. Audio is analysed in the browser and never leaves it.')}</p>
        <div className="row">
          <button className="primary" onClick={active ? stop : start}>
            {active ? t('Stop listening') : t('Start listening')}
          </button>
          <button onClick={() => {
              tracker.current.runs = []
              setRuns([])
            }} disabled={!active && runs.length === 0}>
            {t('Clear')}
          </button>
          <button onClick={detect} disabled={!active}>
            {t('Find tone')}
          </button>
        </div>
        <div className="field">
          <label htmlFor="df">
            {t('Tone frequency')}: {freq} Hz
          </label>
          <input
            id="df"
            type="range"
            min={300}
            max={1200}
            step={5}
            value={freq}
            onChange={(e) => setFreq(+e.target.value)}
          />
        </div>
        <div className="meter" aria-label={t('Signal level')}>
          <div className={'fill' + (tone ? ' on' : '')} style={{ width: `${level * 100}%` }} />
        </div>
        {error && <p className="err-text">{error}</p>}
      </section>
      <section className="box">
        <h3>{t('Decoded')}</h3>
        <div className="screen" aria-live="polite">
          {decoded.text || <span className="muted">{active ? t('Listening…') : t('Nothing yet.')}</span>}
        </div>
        {decoded.wpm !== undefined && decoded.text && (
          <p className="hint">
            {t('Detected speed')}: {decoded.wpm.toFixed(0)} WPM
          </p>
        )}
      </section>
    </div>
  )
}
