import { useEffect, useState } from 'react'
import { tr, type T } from './i18n'
import { loadSettings, saveSettings, type Settings } from './lib/settings'
import { loadProgress, saveProgress, type Progress } from './lib/progress'
import Practice from './components/Practice'
import KeyerPanel from './components/KeyerPanel'
import PlayerPanel from './components/PlayerPanel'
import DecoderPanel from './components/DecoderPanel'
import ChartPanel from './components/ChartPanel'
import StatsPanel from './components/StatsPanel'
import SettingsPanel from './components/SettingsPanel'

const TABS = [
  { id: 'practice', label: 'Copy practice' },
  { id: 'keyer', label: 'Keyer' },
  { id: 'player', label: 'Text to Morse' },
  { id: 'decoder', label: 'Microphone decoder' },
  { id: 'chart', label: 'Chart' },
  { id: 'stats', label: 'Progress' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [tab, setTab] = useState<Tab>(() => {
    const h = location.hash.slice(1)
    return TABS.some((x) => x.id === h) ? (h as Tab) : 'practice'
  })
  const t: T = (s, ...a) => tr(settings.lang, s, ...a)

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveProgress(progress), [progress])
  useEffect(() => {
    history.replaceState(null, '', `#${tab}`)
  }, [tab])
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.lang = settings.lang
  }, [settings.theme, settings.lang])

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Morse code trainer')}</span>
        <span className="hint">{t('Learn CW with the Koch and Farnsworth methods. Everything runs in your browser.')}</span>
      </header>
      <div className="body">
        <aside className="side">
          <SettingsPanel settings={settings} onChange={setSettings} t={t} />
        </aside>
        <main className="main">
          <nav className="tabs" role="tablist">
            {TABS.map((x) => (
              <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'active' : ''} onClick={() => setTab(x.id)}>
                {t(x.label)}
              </button>
            ))}
          </nav>
          {tab === 'practice' && <Practice settings={settings} progress={progress} onProgress={setProgress} t={t} />}
          {tab === 'keyer' && <KeyerPanel settings={settings} onSettings={setSettings} t={t} />}
          {tab === 'player' && <PlayerPanel settings={settings} t={t} />}
          {tab === 'decoder' && <DecoderPanel settings={settings} t={t} />}
          {tab === 'chart' && <ChartPanel settings={settings} t={t} />}
          {tab === 'stats' && <StatsPanel progress={progress} onProgress={setProgress} t={t} />}
        </main>
      </div>
      <p className="hint foot">
        {t('Audio is generated and analysed locally. Nothing is uploaded.')}{' '}
        <a href="https://github.com/hermes98761234/morse-code-trainer">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}
