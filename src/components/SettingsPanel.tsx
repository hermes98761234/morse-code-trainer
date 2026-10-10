import type { Settings } from '../lib/settings'
import { timing } from '../lib/morse'
import type { T } from '../i18n'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  t: T
}

export default function SettingsPanel({ settings, onChange, t }: Props) {
  const set = (p: Partial<Settings>) => {
    const s = { ...settings, ...p }
    s.eff = Math.min(s.eff, s.wpm)
    onChange(s)
  }
  const tm = timing(settings.wpm, settings.eff)
  return (
    <div className="panel">
      <section className="section">
        <h3>{t('Sound')}</h3>
        <div className="field">
          <label htmlFor="wpm">
            {t('Character speed')}: {settings.wpm} WPM
          </label>
          <input id="wpm" type="range" min={5} max={40} value={settings.wpm} onChange={(e) => set({ wpm: +e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="eff">
            {t('Effective speed (Farnsworth)')}: {settings.eff} WPM
          </label>
          <input id="eff" type="range" min={2} max={settings.wpm} value={settings.eff} onChange={(e) => set({ eff: +e.target.value })} />
        </div>
        <p className="hint">
          {t('Dot {0} ms, character gap {1} ms, word gap {2} ms.', Math.round(tm.dit * 1000), Math.round(tm.gapChar * 1000), Math.round(tm.gapWord * 1000))}
        </p>
        <div className="field">
          <label htmlFor="freq">
            {t('Tone')}: {settings.freq} Hz
          </label>
          <input id="freq" type="range" min={300} max={1200} step={10} value={settings.freq} onChange={(e) => set({ freq: +e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="vol">
            {t('Volume')}: {Math.round(settings.volume * 100)}%
          </label>
          <input id="vol" type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => set({ volume: +e.target.value })} />
        </div>
      </section>
      <section className="section">
        <h3>{t('Settings')}</h3>
        <div className="grid2">
          <div className="field">
            <label htmlFor="theme">{t('Theme')}</label>
            <select id="theme" value={settings.theme} onChange={(e) => set({ theme: e.target.value as Settings['theme'] })}>
              <option value="auto">{t('System')}</option>
              <option value="light">{t('Light')}</option>
              <option value="dark">{t('Dark')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="lang">{t('Language')}</label>
            <select id="lang" value={settings.lang} onChange={(e) => set({ lang: e.target.value as Settings['lang'] })}>
              <option value="en">English</option>
              <option value="uk">Українська</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  )
}
