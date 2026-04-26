import { useEffect, useMemo, useRef, useState } from 'react'
import BonfireWidget from '../components/BonfireWidget'
import {
  getClasses,
  getLesson,
  getLessonsByClass,
  getProfile,
  getTranslationLanguages,
  updateProfile,
  logEngagementEvent,
  runChatDiagnostic,
  sendChatMessage,
} from '../services/aiClient'

// ─── Session ID (persisted across re-renders via module scope) ───────────────
function generateSessionId() {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
let _sessionId = null
function getSessionId() {
  if (!_sessionId) _sessionId = generateSessionId()
  return _sessionId
}

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'lessons',     icon: '📚', label: 'Lessons'      },
  { id: 'tutor',       icon: '🤖', label: 'AI Tutor'     },
  { id: 'assignments', icon: '📋', label: 'Assignments'  },
  { id: 'planner',     icon: '📅', label: 'Study Planner'},
  { id: 'bonfire',     icon: '🔥', label: 'Progress'     },
]

const READING_LEVELS = [
  { value: 'FOUNDATIONAL', label: 'Foundational' },
  { value: 'GRADE_LEVEL',  label: 'Grade Level'  },
  { value: 'ADVANCED',     label: 'Advanced'     },
]

const BANDWIDTH_MODES = [
  { value: 'FULL',      label: 'Full Media'    },
  { value: 'REDUCED',   label: 'Reduced Media' },
  { value: 'TEXT_ONLY', label: 'Text Only'     },
]

const FONT_SIZES = [
  { value: 'SMALL',  label: 'Small'      },
  { value: 'MEDIUM', label: 'Medium'     },
  { value: 'LARGE',  label: 'Large'      },
  { value: 'XLARGE', label: 'Extra Large'},
]

const DEFAULT_LANGUAGES = [
  { code: 'en', label: 'English'    },
  { code: 'es', label: 'Español'    },
  { code: 'fr', label: 'Français'   },
  { code: 'zh', label: '中文'        },
  { code: 'ar', label: 'العربية'    },
  { code: 'pt', label: 'Português'  },
  { code: 'de', label: 'Deutsch'    },
  { code: 'ja', label: '日本語'      },
  { code: 'ko', label: '한국어'      },
  { code: 'hi', label: 'हिन्दी'      },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'tl', label: 'Tagalog'    },
]

const SAMPLE_ASSIGNMENTS = [
  { id: 'a1', title: 'Textual Evidence Quiz',    due: '2026-04-28', status: 'Due soon',    course: 'ELA'  },
  { id: 'a2', title: 'Evidence Paragraph Draft', due: '2026-04-30', status: 'Not started', course: 'ELA'  },
  { id: 'a3', title: 'Vocabulary Review',        due: '2026-05-02', status: 'In progress', course: 'ELA'  },
]

const TODAY = new Date()

// ─── Onboarding flow ─────────────────────────────────────────────────────────
// Collects the user profile in plain language — no developer jargon.
const READING_OPTIONS = [
  { value: 'Keep it simple',          tier: 'basic'        },
  { value: 'Some detail is fine',     tier: 'intermediate' },
  { value: 'Give me the full picture',tier: 'advanced'     },
]
const CONNECTIVITY_OPTIONS = [
  { value: 'Old phone or slow internet', tier: 'low'    },
  { value: 'Decent connection',          tier: 'medium' },
  { value: 'Fast laptop or wifi',        tier: 'high'   },
]

function OnboardingScreen({ onComplete }) {
  const [form, setForm] = useState({
    subject: '',
    grade: '',
    readingPreference: 'Some detail is fine',
    connectivity: 'Decent connection',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.subject.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await runChatDiagnostic({
        sessionId: getSessionId(),
        subject: form.subject,
        grade: form.grade,
        readingPreference: form.readingPreference,
        connectivity: form.connectivity,
      })
      // Attach the form's subject so downstream components (banner, tutor greeting) can use it
      onComplete({ ...result, subject: form.subject })
    } catch (err) {
      setError(err.message || 'Could not run diagnostic. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '2rem auto', padding: '0 1rem' }}>
      <div className="bf-card">
        <h2 style={{ marginBottom: '0.25rem' }}>Welcome to EduForge</h2>
        <p className="sv-muted" style={{ marginBottom: '1.5rem' }}>
          Tell us a bit about yourself so we can tailor everything for you.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="full-width">
            What are you studying today?
            <input
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="e.g. Fractions, US History, Biology…"
              required
            />
          </label>

          <label>
            What grade are you in?
            <select
              value={form.grade}
              onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
            >
              <option value="">Select grade</option>
              {['6th','7th','8th','9th','10th','11th','12th','College / Adult'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>

          <label className="full-width">
            How would you describe your reading preference?
            <select
              value={form.readingPreference}
              onChange={(e) => setForm((p) => ({ ...p, readingPreference: e.target.value }))}
            >
              {READING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.value}</option>
              ))}
            </select>
          </label>

          <label className="full-width">
            What kind of device or connection are you on?
            <select
              value={form.connectivity}
              onChange={(e) => setForm((p) => ({ ...p, connectivity: e.target.value }))}
            >
              {CONNECTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.value}</option>
              ))}
            </select>
          </label>

          {error && <p style={{ color: '#f87171' }} className="full-width">{error}</p>}

          <button className="bf-btn full-width" type="submit" disabled={loading}>
            {loading ? 'Setting up your experience…' : 'Start Learning'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Adaptation Banner ───────────────────────────────────────────────────────
function AdaptationBanner({ changes, readingLevel, connectivityTier, subject, onDismiss }) {
  const [expanded, setExpanded] = useState(false)

  const tierLabels = { low: 'Low-bandwidth (text-only)', medium: 'Standard', high: 'Full media' }
  const levelLabels = { basic: 'Simple', intermediate: 'Intermediate', advanced: 'Advanced' }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e3a2f 0%, #0f2419 100%)',
      border: '1px solid #4ade80',
      borderRadius: 8,
      padding: '0.75rem 1rem',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.9rem' }}>
          Your lesson has been adapted based on your profile.
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="pill"
            style={{ fontSize: '0.75em', padding: '2px 8px' }}
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded ? 'Hide' : 'How?'}
          </button>
          <button
            type="button"
            className="pill"
            style={{ fontSize: '0.75em', padding: '2px 8px' }}
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#a7f3d0' }}>
          <p style={{ margin: '0 0 0.4rem' }}>
            <strong>Reading level detected:</strong> {levelLabels[readingLevel] || readingLevel}
          </p>
          <p style={{ margin: '0 0 0.4rem' }}>
            <strong>Connection mode:</strong> {tierLabels[connectivityTier] || connectivityTier}
          </p>
          {subject && (
            <p style={{ margin: '0 0 0.4rem' }}>
              <strong>Subject:</strong> {subject}
            </p>
          )}
          {changes && changes.length > 0 && (
            <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
              {changes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── AI Tutor chat tab ────────────────────────────────────────────────────────
function TutorTab({ onboardingProfile }) {
  const [messages, setMessages]  = useState([{
    role: 'assistant',
    text: onboardingProfile?.subject
      ? `Hi! I'm your EduForge tutor. I see you're working on **${onboardingProfile.subject}**. What would you like to understand better?`
      : "Hi! I'm your EduForge tutor. What are you studying today? Ask me anything!",
  }])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  // Use the properly shaped userProfile (readingLevel/connectivityTier/subject),
  // not the raw diagnostic result (readingLevelEstimate etc.)
  const [profile,  setProfile]  = useState(onboardingProfile?.userProfile || null)
  const [ksState,  setKsState]  = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const tierLabel = { low: 'Low bandwidth', medium: 'Standard', high: 'Full media' }
  const levelLabel = { basic: 'Simple', intermediate: 'Intermediate', advanced: 'Advanced' }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const result = await sendChatMessage({
        message: text,
        sessionId: getSessionId(),
        userProfile: profile,
      })
      setMessages((prev) => [...prev, { role: 'assistant', text: result.reply }])
      if (result.knowledgeState) setKsState(result.knowledgeState)
      if (result.userProfile) setProfile(result.userProfile)
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: `Sorry, I couldn't connect right now. (${err.message})`,
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const concepts = ksState?.conceptsEncountered || []
  const struggling = Object.entries(ksState?.conceptScores || {})
    .filter(([, v]) => v < 0.4).map(([k]) => k)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem' }}>
      {/* Profile badge */}
      {profile && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {profile.subject && (
            <span className="pill active" style={{ fontSize: '0.8em' }}>{profile.subject}</span>
          )}
          <span className="pill" style={{ fontSize: '0.8em' }}>
            {levelLabel[profile.readingLevel] || profile.readingLevel || 'Intermediate'}
          </span>
          <span className="pill" style={{ fontSize: '0.8em' }}>
            {tierLabel[profile.connectivityTier] || profile.connectivityTier || 'Standard'}
          </span>
        </div>
      )}

      {/* Chat window */}
      <div className="bf-card" style={{
        flex: 1, overflowY: 'auto', padding: '1rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        minHeight: 300, maxHeight: 450,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.role === 'user' ? 'var(--accent)' : 'var(--card)',
            color: m.role === 'user' ? '#000' : 'var(--text)',
            border: m.role === 'assistant' ? '1px solid var(--line)' : 'none',
            borderRadius: 10,
            padding: '0.6rem 0.9rem',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '0.6rem 0.9rem',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            fontSize: '0.9rem',
            color: 'var(--muted)',
          }}>
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Knowledge state sidebar strip */}
      {concepts.length > 0 && (
        <div className="bf-card" style={{ padding: '0.6rem 1rem', fontSize: '0.8rem' }}>
          <strong style={{ color: 'var(--accent)' }}>Concepts covered this session</strong>
          <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {concepts.map((c) => {
              const score = ksState?.conceptScores?.[c] ?? 0.5
              const color = score > 0.7 ? '#4ade80' : score < 0.4 ? '#f87171' : '#facc15'
              return <span key={c} className="pill" style={{ fontSize: '0.75em', borderColor: color, color }}>{c}</span>
            })}
          </div>
          {struggling.length > 0 && (
            <p style={{ margin: '0.4rem 0 0', color: '#f87171' }}>
              Needs more practice: {struggling.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Input area */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask a question… (Enter to send)"
          rows={2}
          style={{ flex: 1, resize: 'vertical', minHeight: 48 }}
          disabled={loading}
        />
        <button
          className="bf-btn"
          type="button"
          onClick={send}
          disabled={loading || !input.trim()}
          style={{ alignSelf: 'flex-end' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getFontClass(fontSize) {
  return ({ SMALL: 'student-font-small', MEDIUM: 'student-font-medium', LARGE: 'student-font-large', XLARGE: 'student-font-xlarge' })[fontSize] || 'student-font-medium'
}

function getLanguageLabel(code) {
  return DEFAULT_LANGUAGES.find((l) => l.code === code)?.label || code?.toUpperCase() || 'English'
}

function useBandwidthSuggestion(profile, onSuggest) {
  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (!connection || profile.bandwidthMode !== 'FULL') return
    const suggest = () => {
      const t = connection.effectiveType
      if (t === 'slow-2g' || t === '2g') onSuggest('TEXT_ONLY')
      if (t === '3g') onSuggest('REDUCED')
    }
    suggest()
    connection.addEventListener?.('change', suggest)
    return () => connection.removeEventListener?.('change', suggest)
  }, [profile.bandwidthMode, onSuggest])
}

function ProfileToolbar({ profile, languages, saving, onChange }) {
  return (
    <section className="student-toolbar" aria-label="Learner profile controls">
      <label>
        Level
        <select value={profile.readingLevel} onChange={(e) => onChange({ readingLevel: e.target.value })}>
          {READING_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>
      <label>
        Language
        <select value={profile.language} onChange={(e) => onChange({ language: e.target.value })}>
          {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </label>
      <label>
        Bandwidth
        <select value={profile.bandwidthMode} onChange={(e) => onChange({ bandwidthMode: e.target.value })}>
          {BANDWIDTH_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <label>
        Font
        <select value={profile.fontSize} onChange={(e) => onChange({ fontSize: e.target.value })}>
          {FONT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <label className="student-toggle">
        <input type="checkbox" checked={profile.highContrast} onChange={(e) => onChange({ highContrast: e.target.checked })} />
        High contrast
      </label>
      <label className="student-toggle">
        <input type="checkbox" checked={profile.dyslexiaFont} onChange={(e) => onChange({ dyslexiaFont: e.target.checked })} />
        Dyslexia font
      </label>
      <label className="student-toggle">
        <input type="checkbox" checked={profile.ttsEnabled} onChange={(e) => onChange({ ttsEnabled: e.target.checked, ttsProvider: 'WEB_SPEECH' })} />
        Audio
      </label>
      {saving && <span className="student-saving">Saving...</span>}
    </section>
  )
}

function decodeHtml(str) {
  if (!str) return ''
  const el = document.createElement('div')
  el.innerHTML = str
  return el.textContent || el.innerText || ''
}

const TTS_LANG_MAP = { es:'es-ES',fr:'fr-FR',zh:'zh-CN',pt:'pt-BR',ar:'ar-SA',ko:'ko-KR',vi:'vi-VN',hi:'hi-IN',ru:'ru-RU',de:'de-DE',ja:'ja-JP',it:'it-IT',tl:'fil-PH' }
function getTtsLanguage(language) { return TTS_LANG_MAP[language] || 'en-US' }
function normalizeSpeechText(text) { return text.replace(/\s+/g,' ').replace(/\s+([.,;:!?])/g,'$1').trim() }
function chunkTextForSpeech(text, maxLength = 900) {
  const normalized = normalizeSpeechText(text)
  if (!normalized) return []
  const sentenceChunks = normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [normalized]
  const chunks = []; let current = ''
  sentenceChunks.forEach((sentence) => {
    const next = sentence.trim(); if (!next) return
    if (next.length > maxLength) {
      if (current) { chunks.push(current); current = '' }
      for (let i = 0; i < next.length; i += maxLength) chunks.push(next.slice(i, i + maxLength).trim())
      return
    }
    const candidate = current ? `${current} ${next}` : next
    if (candidate.length > maxLength) { chunks.push(current); current = next } else { current = candidate }
  })
  if (current) chunks.push(current)
  return chunks
}

const _voiceCache = { voices: [] }
if (typeof window !== 'undefined' && window.speechSynthesis) {
  const _sync = () => { const v = window.speechSynthesis.getVoices(); if (v.length > 0) _voiceCache.voices = v }
  _sync(); window.speechSynthesis.addEventListener('voiceschanged', _sync)
}
function findVoiceForLanguage(language) {
  const targetLang = getTtsLanguage(language); const langPrefix = targetLang.split('-')[0].toLowerCase()
  const voices = _voiceCache.voices.length > 0 ? _voiceCache.voices : (window.speechSynthesis?.getVoices() || [])
  return voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix))
}

function LessonRenderer({ lesson, profile }) {
  const content = lesson?.content
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef(null); const speechQueueRef = useRef([]); const speechCancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      speechCancelledRef.current = true
      if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) window.speechSynthesis.cancel()
    }
  }, [])

  if (!content) return <p className="sv-muted">Choose a lesson to see the adapted student version.</p>

  const terms = (content.keyVocabulary || []).map((item) => item.term).filter(Boolean)
  const requestedLanguage = getLanguageLabel(profile.language)
  const translationStatusLabel = content._translationFailed
    ? `Translation unavailable: ${requestedLanguage}`
    : content._translated ? `Translated: ${getLanguageLabel(content._targetLang)}` : 'Original English'
  const articleClass = ['student-lesson-article', getFontClass(profile.fontSize), profile.highContrast ? 'student-high-contrast' : '', profile.dyslexiaFont ? 'student-dyslexia' : ''].filter(Boolean).join(' ')

  function speak() {
    if (!content.mainContent || !window.speechSynthesis) return
    const effectiveLang = content._translationFailed ? 'en' : profile.language
    const raw = `${decodeHtml(content.overview)}\n\n${decodeHtml(content.mainContent)}`
    const chunks = chunkTextForSpeech(raw); if (chunks.length === 0) return
    const voice = findVoiceForLanguage(effectiveLang); const targetLang = getTtsLanguage(effectiveLang)
    const speakNext = () => {
      if (speechCancelledRef.current) return
      const nextText = speechQueueRef.current.shift()
      if (!nextText) { setSpeaking(false); utteranceRef.current = null; return }
      const utterance = new SpeechSynthesisUtterance(nextText)
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang } else { utterance.lang = targetLang }
      utterance.onend = speakNext; utterance.onerror = () => { setSpeaking(false); utteranceRef.current = null }
      utteranceRef.current = utterance; window.speechSynthesis.speak(utterance)
    }
    speechCancelledRef.current = false; speechQueueRef.current = chunks; window.speechSynthesis.cancel(); setSpeaking(true); setTimeout(speakNext, 50)
  }

  function stopSpeaking() {
    speechCancelledRef.current = true; speechQueueRef.current = []; window.speechSynthesis.cancel(); utteranceRef.current = null; setSpeaking(false)
  }

  return (
    <article className={articleClass}>
      <div className="student-status-row">
        <span>{lesson.title}</span>
        {lesson.appliedProfile?.readingLevel && (
          <span>{{FOUNDATIONAL:'Foundational',GRADE_LEVEL:'Grade Level',ADVANCED:'Advanced'}[lesson.appliedProfile.readingLevel] || lesson.appliedProfile.readingLevel}</span>
        )}
        <span>{translationStatusLabel}</span>
        {content._textOnly && <span>Text-only mode</span>}
        {content._translationFailed && <span>Showing original lesson</span>}
      </div>

      {profile.ttsEnabled && (
        <button className="bf-btn" type="button" onClick={speaking ? stopSpeaking : speak}>
          {speaking ? 'Stop reading' : 'Read aloud'}
        </button>
      )}

      <h2>{content.levelLabel || lesson.title}</h2>
      {content.lexileRange && <p className="sv-muted">{content.lexileRange}</p>}
      {content.overview && <p className="student-overview">{decodeHtml(content.overview)}</p>}

      {terms.length > 0 && (
        <section>
          <h3>Key Vocabulary</h3>
          <ul className="item-list compact">
            {content.keyVocabulary.map((item) => (
              <li key={item.term}><strong>{item.term}</strong><small>{item.definition}</small></li>
            ))}
          </ul>
        </section>
      )}

      {content.mainContent && (
        <section>
          <h3>Lesson Content</h3>
          <div className="student-main-content" dangerouslySetInnerHTML={{ __html: content.mainContent }} />
        </section>
      )}

      {content.activities?.length > 0 && (
        <section>
          <h3>Activities</h3>
          <ul className="item-list compact">
            {content.activities.map((activity) => (
              <li key={activity.title}>
                <strong>{activity.title}</strong>
                <span>{activity.instructions}</span>
                {activity.estimatedMinutes && <small>{activity.estimatedMinutes} minutes</small>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {content.quiz?.length > 0 && (
        <section>
          <h3>Quick Check</h3>
          <ol className="student-quiz">
            {content.quiz.map((item, index) => (
              <li key={`${item.question}-${index}`}>
                <strong>{item.question}</strong>
                <ul>{(item.options || []).map((option) => <li key={option}>{option}</li>)}</ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  )
}

function LessonsTab({ onboardingProfile, showBanner }) {
  const [classes,          setClasses]          = useState([])
  const [lessons,          setLessons]          = useState([])
  const [selectedLessonId, setSelectedLessonId] = useState(null)
  const [adaptedLesson,    setAdaptedLesson]    = useState(null)
  const [profile,          setProfile]          = useState(null)
  const [languages,        setLanguages]        = useState(DEFAULT_LANGUAGES)
  const [loading,          setLoading]          = useState(true)
  const [lessonLoading,    setLessonLoading]    = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState(null)
  const [suggestedBandwidth, setSuggestedBandwidth] = useState(null)
  const [bannerDismissed, setBannerDismissed]   = useState(false)

  useBandwidthSuggestion(profile || {}, setSuggestedBandwidth)

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [profileResult, classResult, languageResult] = await Promise.all([
          getProfile('student'),
          getClasses('student'),
          getTranslationLanguages('student').catch(() => DEFAULT_LANGUAGES),
        ])
        const loadedProfile = profileResult.profile
        const loadedClasses = classResult.classes || []
        setProfile(loadedProfile)
        setClasses(loadedClasses)
        setLanguages(Array.isArray(languageResult) ? languageResult : DEFAULT_LANGUAGES)

        const allLessons = (
          await Promise.all(loadedClasses.map(async (item) => {
            const result = await getLessonsByClass(item.id, 'student')
            return (result.lessons || []).map((lesson) => ({ ...lesson, className: item.name }))
          }))
        ).flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        setLessons(allLessons)
        if (allLessons[0]) setSelectedLessonId(allLessons[0].id)
      } catch (err) {
        setError(err.message || 'Could not load student lessons.')
      } finally {
        setLoading(false)
      }
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    async function loadLesson() {
      if (!selectedLessonId || !profile) return
      setLessonLoading(true); setError(null)
      try { setAdaptedLesson(await getLesson(selectedLessonId, 'student')) }
      catch (err) { setError(err.message || 'Could not adapt this lesson.') }
      finally { setLessonLoading(false) }
    }
    loadLesson()
  }, [selectedLessonId, profile])

  async function changeProfile(updates) {
    if (!profile) return
    const nextProfile = { ...profile, ...updates }
    setProfile(nextProfile); setSaving(true); setSuggestedBandwidth(null)
    if (selectedLessonId) {
      if ('language' in updates) logEngagementEvent({ lessonId: selectedLessonId, eventType: 'LANGUAGE_TOGGLE', metadata: { from: profile.language, to: updates.language } })
      if ('bandwidthMode' in updates) logEngagementEvent({ lessonId: selectedLessonId, eventType: 'BANDWIDTH_CHANGE', metadata: { from: profile.bandwidthMode, to: updates.bandwidthMode } })
      if ('ttsEnabled' in updates) logEngagementEvent({ lessonId: selectedLessonId, eventType: 'TTS_TOGGLE', metadata: { enabled: updates.ttsEnabled } })
    }
    try { const result = await updateProfile(updates, 'student'); setProfile(result.profile) }
    catch (err) { setError(err.message || 'Could not save profile changes.'); setProfile(profile) }
    finally { setSaving(false) }
  }

  if (loading) return <p className="sv-muted">Loading lessons...</p>
  if (error && lessons.length === 0) return <p style={{ color: '#fca5a5' }}>{error}</p>
  if (!profile) return <p className="sv-muted">Loading learner profile...</p>

  return (
    <div className="student-lessons-layout">
      <aside className="student-lesson-sidebar">
        <ProfileToolbar profile={profile} languages={languages} saving={saving} onChange={changeProfile} />

        {suggestedBandwidth && (
          <div className="student-bandwidth-banner">
            <span>Slow connection detected.</span>
            <button type="button" onClick={() => changeProfile({ bandwidthMode: suggestedBandwidth })}>
              Switch to {suggestedBandwidth === 'TEXT_ONLY' ? 'Text Only' : 'Reduced'}
            </button>
            <button type="button" onClick={() => setSuggestedBandwidth(null)}>Dismiss</button>
          </div>
        )}

        <h3>Published Lessons</h3>
        {classes.length === 0 && <p className="sv-muted">Join a class to see lessons.</p>}
        <ul className="sv-lesson-list">
          {lessons.map((lesson) => (
            <li
              key={lesson.id}
              className={`sv-lesson-item ${selectedLessonId === lesson.id ? 'active' : ''}`}
              onClick={() => setSelectedLessonId(lesson.id)}
            >
              <strong>{lesson.title}</strong>
              <span>{lesson.className}</span>
              <small>{new Date(lesson.createdAt).toLocaleDateString()}</small>
            </li>
          ))}
        </ul>
      </aside>

      <main className="student-lesson-panel">
        {showBanner && !bannerDismissed && onboardingProfile && (
          <AdaptationBanner
            changes={onboardingProfile.adaptationChanges}
            readingLevel={onboardingProfile.readingLevelEstimate}
            connectivityTier={onboardingProfile.connectivityTierEstimate}
            subject={onboardingProfile.subject}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}
        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
        {lessonLoading ? (
          <p className="sv-muted">Adapting lesson for your profile...</p>
        ) : (
          <LessonRenderer lesson={adaptedLesson} profile={profile} />
        )}
      </main>
    </div>
  )
}

function AssignmentsTab() {
  const [done, setDone] = useState(new Set())
  function toggle(id) { setDone((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>Your upcoming assignments from all classes.</p>
      <ul className="sv-assignment-list">
        {SAMPLE_ASSIGNMENTS.map((a) => (
          <li key={a.id} className={`sv-assignment-item ${done.has(a.id) ? 'done' : ''}`}>
            <label className="sv-check-row">
              <input type="checkbox" checked={done.has(a.id)} onChange={() => toggle(a.id)} />
              <div>
                <strong>{a.title}</strong>
                <span>{a.course} - Due {a.due}</span>
                <small className={`sv-badge ${a.status === 'Due soon' ? 'warn' : ''}`}>{a.status}</small>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PlannerTab() {
  const [done, setDone] = useState(new Set())
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(TODAY); d.setDate(TODAY.getDate() + i); return d }), [])
  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>A simple two-week plan keeps the next step clear.</p>
      <div className="sv-calendar">
        {days.map((day, i) => {
          const isDone = done.has(i)
          return (
            <div key={i} className={`sv-cal-day ${isDone ? 'done' : ''} ${i === 0 ? 'today' : ''}`}
              onClick={() => setDone((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })}>
              <div className="sv-cal-date">
                <strong>{day.toLocaleDateString('en-US', { weekday: 'short' })}</strong>
                <span>{day.getMonth() + 1}/{day.getDate()}</span>
              </div>
              <div className="sv-cal-task">
                <span className="sv-type-dot" style={{ background: i % 2 ? '#60a5fa' : '#4ade80' }} />
                <span>{isDone ? <s>Review adapted lesson</s> : 'Review adapted lesson'}</span>
              </div>
              {i === 0 && <span className="sv-today-badge">Today</span>}
              {isDone && <span className="sv-done-badge">Done</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BonfireTab() {
  const [progress, setProgress] = useState({ fuelPoints: 160, studySessions: 5, missedDays: 0 })
  const focusLevel = useMemo(() => {
    if (progress.fuelPoints > 300) return 'High Growth Momentum'
    if (progress.fuelPoints > 220) return 'On Track'
    if (progress.fuelPoints > 120) return 'Needs Reinforcement'
    return 'Intervention Recommended'
  }, [progress.fuelPoints])
  return (
    <div className="bf-card" style={{ maxWidth: '520px' }}>
      <BonfireWidget progress={progress} />
      <div className="progress-controls">
        <button className="bf-btn" type="button" onClick={() => setProgress((p) => ({ ...p, fuelPoints: p.fuelPoints + 12 }))}>Complete task</button>
        <button className="bf-btn ghost" type="button" onClick={() => setProgress((p) => ({ ...p, fuelPoints: Math.max(20, p.fuelPoints - 8), missedDays: p.missedDays + 1 }))}>Missed day</button>
      </div>
      <p>Current level: <strong>{focusLevel}</strong></p>
    </div>
  )
}

// ─── Main StudentView shell ───────────────────────────────────────────────────
export default function StudentView() {
  const [onboardingProfile, setOnboardingProfile] = useState(null) // null = not done yet
  const [onboardingDone,    setOnboardingDone]    = useState(false)
  const [activeTab,         setActiveTab]          = useState('lessons')
  const current = TABS.find((t) => t.id === activeTab)

  function handleOnboardingComplete(result) {
    setOnboardingProfile(result)
    setOnboardingDone(true)
    setActiveTab('lessons')
  }

  // Show onboarding only once per session (skip if already done)
  if (!onboardingDone) {
    return (
      <div className="sv-shell">
        <nav className="sv-sidebar">
          <p className="sv-sidebar-label">Student View</p>
          {TABS.map((tab) => (
            <button key={tab.id} type="button" className="sv-tab-btn" disabled>
              <span className="sv-tab-icon">{tab.icon}</span>
              <span className="sv-tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
        <main className="sv-content">
          <header className="sv-content-header">
            <h1>Get Started</h1>
          </header>
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </main>
      </div>
    )
  }

  function renderTab() {
    switch (activeTab) {
      case 'lessons':     return <LessonsTab onboardingProfile={onboardingProfile} showBanner={!!onboardingProfile} />
      case 'tutor':       return <TutorTab onboardingProfile={onboardingProfile} />
      case 'assignments': return <AssignmentsTab />
      case 'planner':     return <PlannerTab />
      case 'bonfire':     return <BonfireTab />
      default:            return null
    }
  }

  return (
    <div className="sv-shell">
      <nav className="sv-sidebar">
        <p className="sv-sidebar-label">Student View</p>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`sv-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="sv-tab-icon">{tab.icon}</span>
            <span className="sv-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
      <main className="sv-content">
        <header className="sv-content-header">
          <h1>{current?.icon} {current?.label}</h1>
        </header>
        {renderTab()}
      </main>
    </div>
  )
}
