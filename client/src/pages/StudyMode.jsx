import { useState } from 'react'
import { adaptContent } from '../services/aiClient'

const MODE_ICONS = {
  visual: '👁',
  audio: '🔊',
  reading: '📖',
  interactive: '✋',
}

export default function StudyMode() {
  const [topic, setTopic] = useState('')
  const [profile, setProfile] = useState({
    readingLevel: 'Grade 6-8',
    language: 'English',
    dyslexiaFont: false,
    highContrast: false,
    screenReader: false,
    bandwidth: 'full-media',
  })
  const [adapted, setAdapted] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeMode, setActiveMode] = useState('reading')

  function updateProfile(event) {
    const { name, value, type, checked } = event.target
    setProfile((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    setAdapted(null)
    try {
      const result = await adaptContent(topic, profile)
      setAdapted(result)
      setActiveMode('reading')
    } catch (err) {
      setError(err.message || 'Adaptation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const currentMode = adapted?.studyModes?.find((m) => m.mode === activeMode)

  return (
    <main className="page-wrap narrow">
      <header className="page-header single">
        <h1>EduEquity Adaptation Layer</h1>
        <p>Every content block adapts in real time to learner profile settings — language, reading level, accessibility — with no separate version management.</p>
      </header>

      {/* ── Learner profile ── */}
      <section className="bf-card">
        <h3>Learner profile</h3>
        <div className="profile-grid">
          <label>
            Reading level
            <select name="readingLevel" value={profile.readingLevel} onChange={updateProfile}>
              <option>Grade 1-3</option>
              <option>Grade 4-5</option>
              <option>Grade 6-8</option>
              <option>Grade 9-12</option>
              <option>Lexile 900+</option>
            </select>
          </label>

          <label>
            Primary language
            <select name="language" value={profile.language} onChange={updateProfile}>
              <option>English</option>
              <option>Spanish</option>
              <option>Mandarin</option>
              <option>Tagalog</option>
              <option>Arabic</option>
              <option>Vietnamese</option>
              <option>Korean</option>
              <option>French</option>
              <option>Portuguese</option>
              <option>Hindi</option>
              <option>Somali</option>
              <option>Hmong</option>
            </select>
          </label>

          <label>
            Bandwidth mode
            <select name="bandwidth" value={profile.bandwidth} onChange={updateProfile}>
              <option value="full-media">Full media</option>
              <option value="reduced-media">Reduced media</option>
              <option value="text-only">Text-only offline</option>
            </select>
          </label>
        </div>

        <div className="toggle-row">
          <label>
            <input type="checkbox" name="dyslexiaFont" checked={profile.dyslexiaFont} onChange={updateProfile} />
            {' '}Dyslexia-friendly formatting
          </label>
          <label>
            <input type="checkbox" name="highContrast" checked={profile.highContrast} onChange={updateProfile} />
            {' '}High contrast
          </label>
          <label>
            <input type="checkbox" name="screenReader" checked={profile.screenReader} onChange={updateProfile} />
            {' '}Screen reader mode
          </label>
        </div>
      </section>

      {/* ── Topic input ── */}
      <section className="bf-card">
        <form className="inline-form" onSubmit={submit}>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a lesson topic, standard, or paste content to adapt"
            required
          />
          <button className="bf-btn" type="submit" disabled={loading}>
            {loading ? 'Adapting content…' : 'Adapt Content'}
          </button>
        </form>
        {error && <p style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</p>}
      </section>

      {/* ── Adapted output ── */}
      {adapted && (
        <section
          className={`eduadapt-preview ${profile.highContrast ? 'high-contrast' : ''} ${profile.dyslexiaFont ? 'dyslexia-font' : ''}`}
          aria-live={profile.screenReader ? 'polite' : 'off'}
        >
          {/* Profile badge */}
          <article className="bf-card" style={{ padding: '0.75rem 1.25rem' }}>
            <p style={{ opacity: 0.8, margin: 0, fontSize: '0.875rem' }}>
              Adapted for: <strong>{adapted.accessibilityMeta?.language}</strong> ·{' '}
              <strong>{adapted.accessibilityMeta?.appliedReadingLevel}</strong> ·{' '}
              Bandwidth: <strong>{adapted.accessibilityMeta?.bandwidthMode}</strong>
              {adapted.accessibilityMeta?.dyslexiaFont ? ' · Dyslexia font' : ''}
              {adapted.accessibilityMeta?.screenReader ? ' · Screen reader' : ''}
            </p>
          </article>

          {/* Main adapted content */}
          <article className="bf-card">
            <h2>{adapted.adaptedTitle}</h2>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: profile.dyslexiaFont ? 2 : 1.7 }}>
              {adapted.mainContent}
            </div>
          </article>

          {/* Key terms */}
          {adapted.keyTerms?.length > 0 && (
            <article className="bf-card">
              <h3>Key terms</h3>
              <ul className="item-list compact">
                {adapted.keyTerms.map((t) => (
                  <li key={t.term}>
                    <strong>{t.term}</strong>
                    <small>{t.definition}</small>
                  </li>
                ))}
              </ul>
            </article>
          )}

          {/* Study mode selector */}
          {adapted.studyModes?.length > 0 && (
            <article className="bf-card">
              <h3>Study modes</h3>
              <div className="pill-row">
                {adapted.studyModes.map((m) => (
                  <button
                    key={m.mode}
                    type="button"
                    className={activeMode === m.mode ? 'pill active' : 'pill'}
                    onClick={() => setActiveMode(m.mode)}
                  >
                    {MODE_ICONS[m.mode]} {m.label}
                  </button>
                ))}
              </div>

              {currentMode && (
                <div className="mode-content" style={{ marginTop: '1rem' }}>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{currentMode.description}</p>
                  {currentMode.accessibilityNote && (
                    <small style={{ opacity: 0.6, display: 'block', marginTop: '0.5rem' }}>
                      Accessibility: {currentMode.accessibilityNote}
                    </small>
                  )}
                </div>
              )}
            </article>
          )}
        </section>
      )}
    </main>
  )
}
