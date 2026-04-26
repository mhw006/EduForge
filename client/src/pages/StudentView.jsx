import { useEffect, useMemo, useRef, useState } from 'react'
import BonfireWidget from '../components/BonfireWidget'
import {
  getClasses,
  getLesson,
  getLessonsByClass,
  getProfile,
  getTranslationLanguages,
  updateProfile,
} from '../services/aiClient'

const TABS = [
  { id: 'lessons', icon: '📚', label: 'Lessons' },
  { id: 'assignments', icon: '📋', label: 'Assignments' },
  { id: 'planner', icon: '📅', label: 'Study Planner' },
  { id: 'bonfire', icon: '🔥', label: 'Progress' },
]

const READING_LEVELS = [
  { value: 'FOUNDATIONAL', label: 'Foundational' },
  { value: 'GRADE_LEVEL', label: 'Grade Level' },
  { value: 'ADVANCED', label: 'Advanced' },
]

const BANDWIDTH_MODES = [
  { value: 'FULL', label: 'Full Media' },
  { value: 'REDUCED', label: 'Reduced Media' },
  { value: 'TEXT_ONLY', label: 'Text Only' },
]

const FONT_SIZES = [
  { value: 'SMALL', label: 'Small' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LARGE', label: 'Large' },
  { value: 'XLARGE', label: 'Extra Large' },
]

const DEFAULT_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'tl', label: 'Tagalog' },
]

const SAMPLE_ASSIGNMENTS = [
  { id: 'a1', title: 'Textual Evidence Quiz', due: '2026-04-28', status: 'Due soon', course: 'ELA' },
  { id: 'a2', title: 'Evidence Paragraph Draft', due: '2026-04-30', status: 'Not started', course: 'ELA' },
  { id: 'a3', title: 'Vocabulary Review', due: '2026-05-02', status: 'In progress', course: 'ELA' },
]

const TODAY = new Date()

function getFontClass(fontSize) {
  return {
    SMALL: 'student-font-small',
    MEDIUM: 'student-font-medium',
    LARGE: 'student-font-large',
    XLARGE: 'student-font-xlarge',
  }[fontSize] || 'student-font-medium'
}

function getLanguageLabel(code) {
  return (
    DEFAULT_LANGUAGES.find((language) => language.code === code)?.label ||
    code?.toUpperCase() ||
    'English'
  )
}

function useBandwidthSuggestion(profile, onSuggest) {
  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (!connection || profile.bandwidthMode !== 'FULL') return

    const suggest = () => {
      const type = connection.effectiveType
      if (type === 'slow-2g' || type === '2g') onSuggest('TEXT_ONLY')
      if (type === '3g') onSuggest('REDUCED')
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
        <select
          value={profile.readingLevel}
          onChange={(e) => onChange({ readingLevel: e.target.value })}
        >
          {READING_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>{level.label}</option>
          ))}
        </select>
      </label>

      <label>
        Language
        <select value={profile.language} onChange={(e) => onChange({ language: e.target.value })}>
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
      </label>

      <label>
        Bandwidth
        <select
          value={profile.bandwidthMode}
          onChange={(e) => onChange({ bandwidthMode: e.target.value })}
        >
          {BANDWIDTH_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>{mode.label}</option>
          ))}
        </select>
      </label>

      <label>
        Font
        <select value={profile.fontSize} onChange={(e) => onChange({ fontSize: e.target.value })}>
          {FONT_SIZES.map((size) => (
            <option key={size.value} value={size.value}>{size.label}</option>
          ))}
        </select>
      </label>

      <label className="student-toggle">
        <input
          type="checkbox"
          checked={profile.highContrast}
          onChange={(e) => onChange({ highContrast: e.target.checked })}
        />
        High contrast
      </label>

      <label className="student-toggle">
        <input
          type="checkbox"
          checked={profile.dyslexiaFont}
          onChange={(e) => onChange({ dyslexiaFont: e.target.checked })}
        />
        Dyslexia font
      </label>

      <label className="student-toggle">
        <input
          type="checkbox"
          checked={profile.ttsEnabled}
          onChange={(e) => onChange({ ttsEnabled: e.target.checked, ttsProvider: 'WEB_SPEECH' })}
        />
        Audio
      </label>

      {saving && <span className="student-saving">Saving...</span>}
    </section>
  )
}

function LessonRenderer({ lesson, profile }) {
  const content = lesson?.content
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef(null)

  useEffect(() => {
    return () => window.speechSynthesis?.cancel()
  }, [])

  if (!content) {
    return <p className="sv-muted">Choose a lesson to see the adapted student version.</p>
  }

  const terms = (content.keyVocabulary || []).map((item) => item.term).filter(Boolean)
  const requestedLanguage = getLanguageLabel(profile.language)
  const translationStatusLabel = content._translationFailed
    ? `Translation unavailable: ${requestedLanguage}`
    : content._translated
      ? `Translated: ${getLanguageLabel(content._targetLang)}`
      : 'Original English'
  const articleClass = [
    'student-lesson-article',
    getFontClass(profile.fontSize),
    profile.highContrast ? 'student-high-contrast' : '',
    profile.dyslexiaFont ? 'student-dyslexia' : '',
  ].filter(Boolean).join(' ')

  function speak() {
    if (!content.mainContent) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(`${content.overview || ''}\n\n${content.mainContent}`)
    const TTS_LANG_MAP = {
      es: 'es-ES', fr: 'fr-FR', zh: 'zh-CN', pt: 'pt-BR',
      ar: 'ar-SA', ko: 'ko-KR', vi: 'vi-VN', hi: 'hi-IN',
      ru: 'ru-RU', de: 'de-DE', ja: 'ja-JP', it: 'it-IT',
    }
    utterance.lang = TTS_LANG_MAP[profile.language] || 'en-US'
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    utteranceRef.current = utterance
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeaking() {
    window.speechSynthesis.cancel()
    setSpeaking(false)
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
      {content.overview && <p className="student-overview">{content.overview}</p>}

      {terms.length > 0 && (
        <section>
          <h3>Key Vocabulary</h3>
          <ul className="item-list compact">
            {content.keyVocabulary.map((item) => (
              <li key={item.term}>
                <strong>{item.term}</strong>
                <small>{item.definition}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {content.mainContent && (
        <section>
          <h3>Lesson Content</h3>
          <div className="student-main-content">{content.mainContent}</div>
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
                <ul>
                  {(item.options || []).map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  )
}

function LessonsTab() {
  const [classes, setClasses] = useState([])
  const [lessons, setLessons] = useState([])
  const [selectedLessonId, setSelectedLessonId] = useState(null)
  const [adaptedLesson, setAdaptedLesson] = useState(null)
  const [profile, setProfile] = useState(null)
  const [languages, setLanguages] = useState(DEFAULT_LANGUAGES)
  const [loading, setLoading] = useState(true)
  const [lessonLoading, setLessonLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [suggestedBandwidth, setSuggestedBandwidth] = useState(null)

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
      setLessonLoading(true)
      setError(null)
      try {
        setAdaptedLesson(await getLesson(selectedLessonId, 'student'))
      } catch (err) {
        setError(err.message || 'Could not adapt this lesson.')
      } finally {
        setLessonLoading(false)
      }
    }

    loadLesson()
  }, [selectedLessonId, profile])

  async function changeProfile(updates) {
    if (!profile) return
    const nextProfile = { ...profile, ...updates }
    setProfile(nextProfile)
    setSaving(true)
    setSuggestedBandwidth(null)

    try {
      const result = await updateProfile(updates, 'student')
      setProfile(result.profile)
    } catch (err) {
      setError(err.message || 'Could not save profile changes.')
      setProfile(profile)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="sv-muted">Loading lessons...</p>
  if (error && lessons.length === 0) return <p style={{ color: '#fca5a5' }}>{error}</p>
  if (!profile) return <p className="sv-muted">Loading learner profile...</p>

  return (
    <div className="student-lessons-layout">
      <aside className="student-lesson-sidebar">
        <ProfileToolbar
          profile={profile}
          languages={languages}
          saving={saving}
          onChange={changeProfile}
        />

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

  function toggle(id) {
    setDone((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>Your upcoming assignments from all classes.</p>
      <ul className="sv-assignment-list">
        {SAMPLE_ASSIGNMENTS.map((assignment) => (
          <li key={assignment.id} className={`sv-assignment-item ${done.has(assignment.id) ? 'done' : ''}`}>
            <label className="sv-check-row">
              <input type="checkbox" checked={done.has(assignment.id)} onChange={() => toggle(assignment.id)} />
              <div>
                <strong>{assignment.title}</strong>
                <span>{assignment.course} - Due {assignment.due}</span>
                <small className={`sv-badge ${assignment.status === 'Due soon' ? 'warn' : ''}`}>{assignment.status}</small>
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
  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(TODAY)
      day.setDate(TODAY.getDate() + index)
      return day
    })
  }, [])

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>A simple two-week plan keeps the next step clear.</p>
      <div className="sv-calendar">
        {days.map((day, index) => {
          const isDone = done.has(index)
          return (
            <div
              key={index}
              className={`sv-cal-day ${isDone ? 'done' : ''} ${index === 0 ? 'today' : ''}`}
              onClick={() => setDone((prev) => {
                const next = new Set(prev)
                next.has(index) ? next.delete(index) : next.add(index)
                return next
              })}
            >
              <div className="sv-cal-date">
                <strong>{day.toLocaleDateString('en-US', { weekday: 'short' })}</strong>
                <span>{day.getMonth() + 1}/{day.getDate()}</span>
              </div>
              <div className="sv-cal-task">
                <span className="sv-type-dot" style={{ background: index % 2 ? '#60a5fa' : '#4ade80' }} />
                <span>{isDone ? <s>Review adapted lesson</s> : 'Review adapted lesson'}</span>
              </div>
              {index === 0 && <span className="sv-today-badge">Today</span>}
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
        <button className="bf-btn" type="button" onClick={() => setProgress((p) => ({ ...p, fuelPoints: p.fuelPoints + 12 }))}>
          Complete task
        </button>
        <button className="bf-btn ghost" type="button" onClick={() => setProgress((p) => ({ ...p, fuelPoints: Math.max(20, p.fuelPoints - 8), missedDays: p.missedDays + 1 }))}>
          Missed day
        </button>
      </div>
      <p>Current level: <strong>{focusLevel}</strong></p>
    </div>
  )
}

export default function StudentView() {
  const [activeTab, setActiveTab] = useState('lessons')
  const current = TABS.find((tab) => tab.id === activeTab)

  function renderTab() {
    switch (activeTab) {
      case 'lessons': return <LessonsTab />
      case 'assignments': return <AssignmentsTab />
      case 'planner': return <PlannerTab />
      case 'bonfire': return <BonfireTab />
      default: return null
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
          <h1>{current?.label}</h1>
        </header>
        {renderTab()}
      </main>
    </div>
  )
}
