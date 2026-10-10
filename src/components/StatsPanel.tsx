import { KOCH_ORDER } from '../lib/drills'
import { EMPTY_PROGRESS, type Progress } from '../lib/progress'
import type { T } from '../i18n'

interface Props {
  progress: Progress
  onProgress: (p: Progress) => void
  t: T
}

export default function StatsPanel({ progress, onProgress, t }: Props) {
  const ss = progress.sessions.slice(-40)
  const W = 560
  const H = 140
  const bw = W / Math.max(ss.length, 1)
  const chars = Object.entries(progress.chars).sort((a, b) => b[1].sent - a[1].sent)
  const totalChars = progress.sessions.reduce((a, s) => a + s.total, 0)
  const totalOk = progress.sessions.reduce((a, s) => a + s.correct, 0)
  return (
    <div className="stack">
      <section className="box">
        <h3>{t('Progress')}</h3>
        <p>
          {t('Sessions')}: <b>{progress.sessions.length}</b> · {t('Characters copied')}: <b>{totalChars}</b> · {t('Overall accuracy')}:{' '}
          <b>{totalChars ? Math.round((100 * totalOk) / totalChars) : 0}%</b> · {t('Koch level')}: <b>{progress.level}</b> ({KOCH_ORDER.slice(0, progress.level + 1).join(' ')})
        </p>
        {ss.length === 0 ? (
          <p className="hint">{t('Nothing yet.')}</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H + 20}`} className="spark" role="img" aria-label={t('Accuracy of the last sessions')}>
            <line x1="0" x2={W} y1={H * 0.1} y2={H * 0.1} className="g90" />
            {ss.map((s, i) => {
              const a = s.total ? s.correct / s.total : 0
              return <rect key={i} x={i * bw + 1} width={Math.max(1, bw - 2)} y={H - a * H} height={a * H} className={a >= 0.9 ? 'ok' : a >= 0.7 ? 'warn' : 'err'} />
            })}
            <text x="2" y={H * 0.1 - 3} className="lbl">
              90%
            </text>
            <text x="2" y={H + 14} className="lbl">
              {t('older')} → {t('newer')}
            </text>
          </svg>
        )}
      </section>
      <section className="box">
        <h3>{t('Per character')}</h3>
        {chars.length === 0 ? (
          <p className="hint">{t('Nothing yet.')}</p>
        ) : (
          <div className="chart">
            {chars.map(([c, v]) => {
              const r = v.miss / v.sent
              return (
                <div key={c} className={'cell stat ' + (r > 0.3 ? 'err' : r > 0.1 ? 'warn' : 'ok')} title={`${v.sent - v.miss}/${v.sent}`}>
                  <b>{c}</b>
                  <span>{Math.round((1 - r) * 100)}%</span>
                  <small>{v.sent}</small>
                </div>
              )
            })}
          </div>
        )}
      </section>
      <button
        className="danger"
        onClick={() => {
          if (window.confirm(t('Erase all progress?'))) onProgress({ ...EMPTY_PROGRESS, sessions: [], chars: {} })
        }}
      >
        {t('Reset progress')}
      </button>
    </div>
  )
}
