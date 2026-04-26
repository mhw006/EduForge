import { useEffect, useMemo, useRef, useState } from 'react'
import BonfireWidget from '../components/BonfireWidget'
import {
  getClasses,
  getDiagnosticCatalog,
  getDiagnosticQuestions,
  getMyDiagnosticSummary,
  getLesson,
  getLessonsByClass,
  getProfile,
  submitDiagnostic,
  getTranslationLanguages,
  updateProfile,
  logEngagementEvent,
  getLessonDiagnostic,
  submitLessonDiagnostic,
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

function formatReadingLevel(level) {
  return {
    FOUNDATIONAL: 'Foundational',
    GRADE_LEVEL: 'Grade Level',
    ADVANCED: 'Advanced',
  }[level] || level || 'Unknown'
}

function formatMathLevel(level) {
  return {
    BELOW_GRADE: 'Below Grade',
    GRADE_LEVEL: 'Grade Level',
    ADVANCED: 'Advanced',
  }[level] || level || 'Unknown'
}

function formatContentFormat(value) {
  return {
    MIXED_MEDIA: 'Mixed media',
    TEXT_FOCUSED: 'Text-focused',
    AUDIO_FOCUSED: 'Audio-focused',
  }[value] || value || 'Standard'
}

function formatDiagnosticDate(value) {
  if (!value) return 'No recent attempt'
  return new Date(value).toLocaleDateString()
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

function DiagnosticSupportBanner({ profile, lesson, diagnostics }) {
  const readingDiagnostic = lesson?.appliedProfile?.diagnosticReadingLevel || profile?.diagnosticReadingLevel
  const mathDiagnostic = lesson?.appliedProfile?.diagnosticMathLevel || profile?.diagnosticMathLevel
  const preferredContentFormat = lesson?.appliedProfile?.preferredContentFormat || profile?.preferredContentFormat

  if (!readingDiagnostic && !mathDiagnostic && !preferredContentFormat) return null

  const readingAligned = readingDiagnostic && lesson?.appliedProfile?.readingLevel === readingDiagnostic

  return (
    <section className="bf-card" style={{ marginBottom: '12px' }}>
      <h3 style={{ marginTop: 0 }}>Diagnostic-driven support</h3>
      <p className="sv-muted" style={{ marginBottom: '0.75rem' }}>
        EduForge is adapting this experience using your latest learner profile and diagnostic signals.
      </p>
      <ul className="item-list compact">
        {readingDiagnostic && (
          <li>
            <strong>Reading placement</strong>
            <span>{formatReadingLevel(readingDiagnostic)}</span>
            <small>
              {diagnostics?.latestReading
                ? `${diagnostics.latestReading.score}/${diagnostics.latestReading.totalQuestions} on ${formatDiagnosticDate(diagnostics.latestReading.completedAt)}${diagnostics.latestReading.className ? ` • ${diagnostics.latestReading.className}` : ''}`
                : profile?.diagnosticReadingLevel
                  ? 'Current lesson support matches the learner profile seeded from your latest available placement signal.'
                  : readingAligned
                  ? 'Current lesson support matches your latest reading diagnostic.'
                  : 'Current lesson support is still being aligned to your latest reading diagnostic.'}
            </small>
          </li>
        )}
        {mathDiagnostic && (
          <li>
            <strong>Math readiness</strong>
            <span>{formatMathLevel(mathDiagnostic)}</span>
            <small>
              {diagnostics?.latestMath
                ? `${diagnostics.latestMath.score}/${diagnostics.latestMath.totalQuestions} on ${formatDiagnosticDate(diagnostics.latestMath.completedAt)}${diagnostics.latestMath.className ? ` • ${diagnostics.latestMath.className}` : ''}`
                : 'This signal helps teachers decide how much math scaffolding to add next.'}
            </small>
          </li>
        )}
        {preferredContentFormat && (
          <li>
            <strong>Recommended content mode</strong>
            <span>{formatContentFormat(preferredContentFormat)}</span>
            <small>Delivery can shift based on your diagnostic and accessibility profile.</small>
          </li>
        )}
      </ul>
    </section>
  )
}

function DiagnosticLauncher({ classes, diagnostics, loading, profile, onComplete }) {
  const [catalog, setCatalog] = useState([])
  const [activeDomain, setActiveDomain] = useState('READING')
  const [questionSet, setQuestionSet] = useState(null)
  const [responses, setResponses] = useState({})
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!selectedClassId && classes[0]?.id) setSelectedClassId(classes[0].id)
  }, [classes, selectedClassId])

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      try {
        const result = await getDiagnosticCatalog('student')
        if (!cancelled) setCatalog(result.diagnostics || [])
      } catch {
        if (!cancelled) setCatalog([])
      }
    }
    loadCatalog()
    return () => { cancelled = true }
  }, [])

  async function startDiagnostic(domain) {
    setError(null)
    setResponses({})
    try {
      setActiveDomain(domain)
      const result = await getDiagnosticQuestions(domain, 'student')
      setQuestionSet(result)
    } catch (err) {
      setError(err.message || 'Could not load the diagnostic.')
    }
  }

  async function submitDiagnosticAttempt() {
    if (!questionSet || !selectedClassId) return
    const unanswered = questionSet.questions.filter((question) => !responses[question.id])
    if (unanswered.length > 0) {
      setError('Answer every question before submitting the diagnostic.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await submitDiagnostic({
        domain: activeDomain,
        classId: selectedClassId,
        responses: questionSet.questions.map((question) => ({
          questionId: question.id,
          selectedOptionId: responses[question.id],
        })),
      }, 'student')

      setQuestionSet(null)
      setResponses({})
      await onComplete?.()
    } catch (err) {
      setError(err.message || 'Could not submit the diagnostic.')
    } finally {
      setSubmitting(false)
    }
  }

  const readingCompleted = Boolean(diagnostics?.latestReading)
  const mathCompleted = Boolean(diagnostics?.latestMath)
  const hasClassContext = classes.length > 0

  return (
    <section className="bf-card" style={{ marginBottom: '12px' }}>
      <h3 style={{ marginTop: 0 }}>Diagnostics</h3>
      <p className="sv-muted" style={{ marginBottom: '0.75rem' }}>
        Run quick placement checks to update the learner profile that powers lesson adaptation.
      </p>

      {!questionSet ? (
        <>
          <div style={{ display: 'grid', gap: '12px', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="sv-muted">
                {readingCompleted
                  ? `Latest reading diagnostic: ${formatReadingLevel(diagnostics.latestReading.inferredLevel)}`
                  : profile?.diagnosticReadingLevel
                    ? `Current reading profile is set to ${formatReadingLevel(profile.diagnosticReadingLevel)}. Run a fresh diagnostic to validate or update it.`
                    : 'No reading diagnostic completed yet'}
              </span>
              {catalog.find((item) => item.domain === 'READING') && (
                <button className="bf-btn" type="button" onClick={() => startDiagnostic('READING')} disabled={loading || !hasClassContext}>
                  {readingCompleted ? 'Retake reading diagnostic' : 'Start reading diagnostic'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="sv-muted">
                {mathCompleted
                  ? `Latest math diagnostic: ${formatMathLevel(diagnostics.latestMath.inferredLevel)}`
                  : profile?.diagnosticMathLevel
                    ? `Current math profile is set to ${formatMathLevel(profile.diagnosticMathLevel)}. Run a fresh diagnostic to validate or update it.`
                    : 'No math diagnostic completed yet'}
              </span>
              {catalog.find((item) => item.domain === 'MATH') && (
                <button className="bf-btn ghost" type="button" onClick={() => startDiagnostic('MATH')} disabled={loading || !hasClassContext}>
                  {mathCompleted ? 'Retake math diagnostic' : 'Start math diagnostic'}
                </button>
              )}
            </div>
          </div>

          {classes.length > 0 ? (
            <label style={{ display: 'grid', gap: '6px', maxWidth: '280px' }}>
              <span className="sv-muted">Apply results to class</span>
              <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="sv-muted" style={{ margin: 0 }}>
              Join a class to unlock diagnostic attempts and adaptive lesson updates.
            </p>
          )}
        </>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          <p style={{ margin: 0 }}><strong>{questionSet.title}</strong></p>
          {questionSet.questions.map((question) => (
            <div key={question.id} className="sv-diagnostic-question">
              <strong>{question.prompt}</strong>
              <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                {question.options.map((option) => (
                  <label key={option.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      checked={responses[question.id] === option.id}
                      onChange={() => setResponses((prev) => ({ ...prev, [question.id]: option.id }))}
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="bf-btn" type="button" onClick={submitDiagnosticAttempt} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit diagnostic'}
            </button>
            <button className="bf-btn ghost" type="button" onClick={() => { setQuestionSet(null); setResponses({}); setError(null) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: '#fca5a5', marginTop: '0.75rem' }}>{error}</p>}
    </section>
  )
}

function decodeHtml(str) {
  if (!str) return ''
  const el = document.createElement('div')
  el.innerHTML = str
  return el.textContent || el.innerText || ''
}

const TTS_LANG_MAP = {
  es: 'es-ES',
  fr: 'fr-FR',
  zh: 'zh-CN',
  pt: 'pt-BR',
  ar: 'ar-SA',
  ko: 'ko-KR',
  vi: 'vi-VN',
  hi: 'hi-IN',
  ru: 'ru-RU',
  de: 'de-DE',
  ja: 'ja-JP',
  it: 'it-IT',
  tl: 'fil-PH',
}

function getTtsLanguage(language) {
  return TTS_LANG_MAP[language] || 'en-US'
}

function normalizeSpeechText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

function chunkTextForSpeech(text, maxLength = 900) {
  const normalized = normalizeSpeechText(text)
  if (!normalized) return []

  const sentenceChunks = normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [normalized]
  const chunks = []
  let current = ''

  sentenceChunks.forEach((sentence) => {
    const next = sentence.trim()
    if (!next) return

    if (next.length > maxLength) {
      if (current) {
        chunks.push(current)
        current = ''
      }

      for (let index = 0; index < next.length; index += maxLength) {
        chunks.push(next.slice(index, index + maxLength).trim())
      }
      return
    }

    const candidate = current ? `${current} ${next}` : next
    if (candidate.length > maxLength) {
      chunks.push(current)
      current = next
    } else {
      current = candidate
    }
  })

  if (current) chunks.push(current)
  return chunks
}

function findVoiceForLanguage(language) {
  const targetLang = getTtsLanguage(language)
  const langPrefix = targetLang.split('-')[0].toLowerCase()
  const voices = _voiceCache.voices.length > 0
    ? _voiceCache.voices
    : (window.speechSynthesis?.getVoices() || [])

  return voices.find((voice) => voice.lang.toLowerCase().startsWith(langPrefix))
}

// Module-level voice cache — survives component unmount/remount on level changes.
const _voiceCache = { voices: [] }
if (typeof window !== 'undefined' && window.speechSynthesis) {
  const _syncVoices = () => {
    const v = window.speechSynthesis.getVoices()
    if (v.length > 0) _voiceCache.voices = v
  }
  _syncVoices()
  window.speechSynthesis.addEventListener('voiceschanged', _syncVoices)
}

const READING_LEVEL_LABELS = {
  FOUNDATIONAL: 'Foundational',
  GRADE_LEVEL: 'Grade Level',
  ADVANCED: 'Advanced',
}

const BANDWIDTH_LABELS = {
  FULL: 'Full Media',
  REDUCED: 'Reduced Media',
  TEXT_ONLY: 'Text Only',
}

const LESSON_MODES = [
  { id: 'interactive', label: 'Interactive lesson' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'cloze', label: 'Fill-in-the-blank' },
  { id: 'quiz', label: 'Quiz mode' },
  { id: 'visual', label: 'Visual explanation' },
  { id: 'practice', label: 'Practice problems' },
  { id: 'plan', label: 'Daily focus plan' },
]

function stripHtml(value) {
  if (!value) return ''
  const html = String(value).replace(/<\/(p|div|li|h[1-6])>/gi, '</$1>\n')
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ')
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent || el.innerText || ''
}

function getLessonSections(content) {
  const sections = []
  if (content?.overview) {
    sections.push({ title: 'Overview', body: stripHtml(content.overview) })
  }

  const mainText = stripHtml(content?.mainContent)
  const paragraphs = mainText
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((item) => item.trim())
    .filter((item) => item.length > 40)

  if (paragraphs.length > 0) {
    paragraphs.slice(0, 5).forEach((paragraph, index) => {
      sections.push({ title: `Section ${index + 1}`, body: paragraph })
    })
  } else if (mainText) {
    sections.push({ title: 'Lesson Content', body: mainText })
  }

  return sections.length > 0 ? sections : [{ title: 'Lesson', body: 'This lesson is ready for review.' }]
}

function getVocabulary(content) {
  return (content?.keyVocabulary || []).filter((item) => item?.term && item?.definition)
}

function getOptionLetter(option, fallbackIndex) {
  const match = String(option || '').trim().match(/^([A-D])[\).:-]?\s/i)
  return match ? match[1].toUpperCase() : String.fromCharCode(65 + fallbackIndex)
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || []
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getTermPattern(term) {
  const words = String(term || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const pattern = words
    .map((word) => {
      const suffix = word.length > 3 && !/[ses]$/i.test(word) ? '(?:s|es)?' : ''
      return `${escapeRegExp(word)}${suffix}`
    })
    .join('\\s+')
  return new RegExp(`\\b${pattern}\\b`, 'i')
}

function findClozeSentence(sentences, term, usedSentences) {
  const termPattern = getTermPattern(term)
  const exact = sentences.find((sentence) => termPattern?.test(sentence) && !usedSentences.has(sentence))
    || sentences.find((sentence) => termPattern?.test(sentence))
  if (exact) {
    const match = exact.match(termPattern)?.[0] || term
    return { sentence: exact, match, answer: match }
  }

  const termWords = String(term || '').toLowerCase().split(/\W+/).filter((word) => word.length > 3)
  const partial = sentences.find((sentence) => {
    if (usedSentences.has(sentence)) return false
    const lower = sentence.toLowerCase()
    return termWords.some((word) => lower.includes(word) || lower.includes(`${word}s`))
  }) || sentences.find((sentence) => {
    const lower = sentence.toLowerCase()
    return termWords.some((word) => lower.includes(word) || lower.includes(`${word}s`))
  })

  if (partial) {
    const matchedWord = termWords.find((word) => partial.toLowerCase().includes(word))
    const match = partial.match(new RegExp(`\\b${escapeRegExp(matchedWord)}(?:s|es)?\\b`, 'i'))?.[0]
    if (match) return { sentence: partial, match, answer: match }
  }

  return null
}

function makeClozeItems(content) {
  const text = stripHtml(content?.mainContent)
  const sentences = splitSentences(text)
  const usedSentences = new Set()

  return getVocabulary(content).slice(0, 6).map((item) => {
    const found = findClozeSentence(sentences, item.term, usedSentences)
    const sentence = found?.sentence || `${item.term} means ${item.definition}`
    const answer = found?.answer || item.term
    const blankTarget = found?.match || item.term
    usedSentences.add(sentence)

    return {
      term: item.term,
      answer,
      prompt: sentence.replace(new RegExp(`\\b${escapeRegExp(blankTarget)}\\b`, 'i'), '__________'),
      hint: item.definition,
    }
  }).filter((item) => item.prompt.includes('__________'))
}

function makePracticeItems(content) {
  const vocab = getVocabulary(content)
  const activities = content?.activities || []
  const quiz = content?.quiz || []
  const items = []

  if (vocab[0]) {
    items.push({
      prompt: `Explain ${vocab[0].term} in your own words and connect it to the lesson.`,
      answer: vocab[0].definition,
    })
  }
  if (activities[0]) {
    items.push({
      prompt: `Use the lesson to complete this worked example: ${activities[0].title}. What steps would you take first?`,
      answer: activities[0].instructions,
    })
  }
  if (quiz[0]) {
    items.push({
      prompt: `Create a short answer response for this idea: ${quiz[0].question}`,
      answer: quiz[0].explanation || `Check your response against the lesson's explanation for answer ${quiz[0].correctAnswer}.`,
    })
  }

  return items.slice(0, 3)
}

// ─── DiagnosticPanel ─────────────────────────────────────────────────────────
// Self-contained component. Reset per lesson via key={lessonId}.
function DiagnosticPanel({ lessonId, onComplete }) {
  const [phase, setPhase] = useState('loading') // loading | ready | scoring | done | error | dismissed
  const [diagnostic, setDiagnostic] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!lessonId) { setPhase('error'); return }
    setPhase('loading')
    getLessonDiagnostic(lessonId)
      .then((data) => { setDiagnostic(data); setPhase('ready') })
      .catch(() => setPhase('error'))
  }, [lessonId])

  async function handleSubmit() {
    if (!diagnostic) return
    setPhase('scoring')
    try {
      const res = await submitLessonDiagnostic(lessonId, answers)
      setResult(res)
      setPhase('done')
      onComplete(res)
    } catch {
      setPhase('error')
    }
  }

  if (phase === 'dismissed') return null

  if (phase === 'loading') {
    return (
      <div className="diagnostic-card">
        <p className="sv-muted">Preparing diagnostic...</p>
      </div>
    )
  }

  if (phase === 'scoring') {
    return (
      <div className="diagnostic-card">
        <p className="sv-muted">Scoring... Applying adaptation...</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="diagnostic-card">
        <p className="sv-muted">Could not load diagnostic. Continue with your lesson below.</p>
        <button className="bf-btn ghost small" type="button" onClick={() => setPhase('dismissed')}>
          Dismiss
        </button>
      </div>
    )
  }

  if (phase === 'done' && result) {
    const levelChanged = result.newReadingLevel !== result.previousReadingLevel
    return (
      <div className="diagnostic-card adaptation-done">
        <div className="adaptation-header">
          <div className="adaptation-check">✓</div>
          <h3>Adaptation Applied</h3>
          <button className="bf-btn ghost small" type="button" onClick={() => setPhase('dismissed')}>
            ✕
          </button>
        </div>
        <p style={{ margin: '0 0 6px', fontSize: '14px' }}>
          Diagnostic score: <strong>{result.score} / {result.totalQuestions}</strong>
        </p>
        <p style={{ margin: '0 0 6px', fontSize: '14px' }}>
          Reading level:{' '}
          <span className="level-badge">{READING_LEVEL_LABELS[result.previousReadingLevel] || result.previousReadingLevel}</span>
          {' → '}
          <span className={`level-badge${levelChanged ? ' changed' : ''}`}>
            {READING_LEVEL_LABELS[result.newReadingLevel] || result.newReadingLevel}
          </span>
        </p>
        {result.skillsMissed?.length > 0 && (
          <div className="adaptation-why-dots">
            {[...new Set(result.skillsMissed)].map((skill) => (
              <span key={skill} className="adaptation-why-tag">{skill}</span>
            ))}
          </div>
        )}
        <p className="adaptation-reason">{result.adaptationReason}</p>
        {result.nextAction && <p className="sv-muted" style={{ fontSize: '13px', margin: '4px 0 0' }}>{result.nextAction}</p>}
      </div>
    )
  }

  // phase === 'ready'
  const { questions = [], title } = diagnostic || {}
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id])

  return (
    <div className="diagnostic-card">
      <div className="diagnostic-header">
        <div>
          <h3>Quick Learning Check</h3>
          <p>Answer {questions.length} questions so EduForge can adapt this lesson to you.</p>
        </div>
        <button className="bf-btn ghost small" type="button" onClick={() => setPhase('dismissed')}>
          Skip
        </button>
      </div>

      <ol className="diagnostic-questions">
        {questions.map((q) => (
          <li key={q.id} className="diagnostic-question">
            <p>{q.question}</p>
            <ul className="diagnostic-options">
              {(q.options || []).map((option) => {
                const letter = option[0]
                return (
                  <li key={option}>
                    <button
                      type="button"
                      className={`diagnostic-option${answers[q.id] === letter ? ' selected' : ''}`}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                    >
                      {option}
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>

      <div className="diagnostic-submit-row">
        <button
          type="button"
          className="bf-btn"
          onClick={handleSubmit}
          disabled={!allAnswered}
        >
          Submit Answers
        </button>
        {!allAnswered && (
          <span className="sv-muted" style={{ fontSize: '12px' }}>Answer all questions to submit.</span>
        )}
      </div>
    </div>
  )
}

// ─── AdaptationBanner ─────────────────────────────────────────────────────────
// Shows alongside lesson content explaining why the lesson looks this way.
// Only renders when at least one non-default setting is active.
function AdaptationBanner({ profile }) {
  if (!profile) return null

  const hasDiagnostic = Boolean(profile.diagnosticReadingLevel)
  const hasNonDefaultLevel = profile.readingLevel !== 'GRADE_LEVEL'
  const hasNonDefaultLanguage = profile.language && profile.language !== 'en'
  const hasNonDefaultBandwidth = profile.bandwidthMode && profile.bandwidthMode !== 'FULL'

  // Collect human-readable reasons for the sentence
  const parts = [
    hasDiagnostic ? `diagnostic result (${READING_LEVEL_LABELS[profile.readingLevel] || profile.readingLevel})` : (hasNonDefaultLevel ? `${READING_LEVEL_LABELS[profile.readingLevel] || profile.readingLevel} reading level` : null),
    hasNonDefaultLanguage ? `${getLanguageLabel(profile.language)} language preference` : null,
    hasNonDefaultBandwidth ? `${BANDWIDTH_LABELS[profile.bandwidthMode]} mode` : null,
    profile.highContrast ? 'high contrast display' : null,
    profile.dyslexiaFont ? 'dyslexia font' : null,
    profile.ttsEnabled ? 'text-to-speech' : null,
  ].filter(Boolean)

  if (parts.length === 0) return null

  return (
    <div className="adaptation-why-card">
      <strong>Why this lesson looks this way</strong>
      <div className="adaptation-why-dots" style={{ marginTop: '6px' }}>
        {(hasDiagnostic || hasNonDefaultLevel) && (
          <span className="adaptation-why-tag">
            Level: {READING_LEVEL_LABELS[profile.readingLevel] || profile.readingLevel}
          </span>
        )}
        {hasNonDefaultLanguage && (
          <span className="adaptation-why-tag">
            Language: {getLanguageLabel(profile.language)}
          </span>
        )}
        {hasNonDefaultBandwidth && (
          <span className="adaptation-why-tag">
            {BANDWIDTH_LABELS[profile.bandwidthMode]}
          </span>
        )}
        {profile.highContrast && <span className="adaptation-why-tag">High contrast</span>}
        {profile.dyslexiaFont && <span className="adaptation-why-tag">Dyslexia font</span>}
        {profile.ttsEnabled && <span className="adaptation-why-tag">TTS on</span>}
      </div>
      <p className="sv-muted" style={{ margin: '6px 0 0', fontSize: '12px' }}>
        This version was adapted using your {parts.join(', ')}.
      </p>
    </div>
  )
}

function InteractiveLessonMode({ content }) {
  const sections = useMemo(() => getLessonSections(content), [content])
  const [activeSection, setActiveSection] = useState(0)
  const completedCount = Math.min(activeSection + 1, sections.length)
  const progress = Math.round((completedCount / sections.length) * 100)
  const current = sections[activeSection]

  useEffect(() => {
    setActiveSection(0)
  }, [content])

  return (
    <section className="lesson-mode-panel">
      <div className="lesson-progress-header">
        <div>
          <h3>{current.title}</h3>
          <p className="sv-muted">Section {activeSection + 1} of {sections.length}</p>
        </div>
        <strong>{progress}%</strong>
      </div>
      <div className="lesson-progress-track" aria-label="Lesson progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="student-overview">{current.body}</p>
      <div className="lesson-step-controls">
        <button className="bf-btn ghost" type="button" onClick={() => setActiveSection((value) => Math.max(0, value - 1))} disabled={activeSection === 0}>
          Previous
        </button>
        <button className="bf-btn" type="button" onClick={() => setActiveSection((value) => Math.min(sections.length - 1, value + 1))} disabled={activeSection === sections.length - 1}>
          Next section
        </button>
      </div>
    </section>
  )
}

function FlashcardsMode({ content }) {
  const cards = getVocabulary(content)
  const [flipped, setFlipped] = useState({})

  if (cards.length === 0) return <p className="sv-muted">No vocabulary cards are available for this lesson yet.</p>

  return (
    <section className="lesson-mode-grid">
      {cards.map((card) => (
        <button
          key={card.term}
          type="button"
          className={`flashcard ${flipped[card.term] ? 'flipped' : ''}`}
          onClick={() => setFlipped((prev) => ({ ...prev, [card.term]: !prev[card.term] }))}
        >
          <span>{flipped[card.term] ? card.definition : card.term}</span>
          <small>{flipped[card.term] ? 'Definition' : 'Tap to flip'}</small>
        </button>
      ))}
    </section>
  )
}

function ClozeMode({ content }) {
  const items = useMemo(() => makeClozeItems(content), [content])
  const [answers, setAnswers] = useState({})
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setAnswers({})
    setChecked(false)
  }, [content])

  if (items.length === 0) return <p className="sv-muted">Add vocabulary to this lesson to unlock fill-in-the-blank practice.</p>

  return (
    <section className="lesson-mode-panel">
      <ol className="cloze-list">
        {items.map((item, index) => {
          const response = answers[index] || ''
          const correct = response.trim().toLowerCase() === item.answer.toLowerCase()
          return (
            <li key={`${item.term}-${index}`}>
              <p>{item.prompt}</p>
              <input
                type="text"
                value={response}
                placeholder="Type the missing term"
                onChange={(e) => setAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
              />
              {checked && (
                <small className={correct ? 'answer-correct' : 'answer-review'}>
                  {correct ? 'Correct' : `Review: ${item.answer} - ${item.hint}`}
                </small>
              )}
            </li>
          )
        })}
      </ol>
      <button className="bf-btn" type="button" onClick={() => setChecked(true)}>Check answers</button>
    </section>
  )
}

function QuizMode({ content }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const quiz = content?.quiz || []

  useEffect(() => {
    setAnswers({})
    setSubmitted(false)
  }, [content])

  if (quiz.length === 0) return <p className="sv-muted">No quiz questions are available for this lesson yet.</p>

  const score = quiz.reduce((total, item, index) => total + (answers[index] === item.correctAnswer ? 1 : 0), 0)

  return (
    <section className="lesson-mode-panel">
      <ol className="student-quiz interactive">
        {quiz.map((item, index) => (
          <li key={`${item.question}-${index}`}>
            <strong>{item.question}</strong>
            <div className="quiz-option-grid">
              {(item.options || []).map((option, optionIndex) => {
                const letter = getOptionLetter(option, optionIndex)
                const selected = answers[index] === letter
                const correct = submitted && item.correctAnswer === letter
                return (
                  <button
                    key={option}
                    type="button"
                    className={`quiz-option ${selected ? 'selected' : ''} ${correct ? 'correct' : ''}`}
                    onClick={() => setAnswers((prev) => ({ ...prev, [index]: letter }))}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            {submitted && (
              <small className={answers[index] === item.correctAnswer ? 'answer-correct' : 'answer-review'}>
                {answers[index] === item.correctAnswer ? 'Correct.' : `Correct answer: ${item.correctAnswer}.`} {item.explanation}
              </small>
            )}
          </li>
        ))}
      </ol>
      <div className="lesson-step-controls">
        <button className="bf-btn" type="button" onClick={() => setSubmitted(true)}>Submit quiz</button>
        {submitted && <strong>{score} / {quiz.length} correct</strong>}
      </div>
    </section>
  )
}

function VisualExplanationMode({ content }) {
  const vocab = getVocabulary(content).slice(0, 4)
  const activities = content?.activities || []

  return (
    <section className="visual-map">
      <div className="visual-node primary">
        <span>Main idea</span>
        <strong>{content?.overview ? stripHtml(content.overview) : content?.levelLabel || 'Lesson focus'}</strong>
      </div>
      <div className="visual-branches">
        {vocab.map((item) => (
          <div key={item.term} className="visual-node">
            <span>{item.term}</span>
            <p>{item.definition}</p>
          </div>
        ))}
      </div>
      {activities.length > 0 && (
        <div className="visual-steps">
          {activities.slice(0, 3).map((activity, index) => (
            <div key={activity.title} className="visual-step">
              <strong>{index + 1}</strong>
              <span>{activity.title}</span>
              <p>{activity.instructions}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function PracticeProblemsMode({ content }) {
  const problems = makePracticeItems(content)
  const [revealed, setRevealed] = useState({})

  if (problems.length === 0) return <p className="sv-muted">Practice problems will appear when the lesson has vocabulary, activities, or quiz explanations.</p>

  return (
    <section className="lesson-mode-panel">
      <ol className="practice-list">
        {problems.map((problem, index) => (
          <li key={`${problem.prompt}-${index}`}>
            <strong>{problem.prompt}</strong>
            <button className="bf-btn ghost small" type="button" onClick={() => setRevealed((prev) => ({ ...prev, [index]: !prev[index] }))}>
              {revealed[index] ? 'Hide answer' : 'Reveal answer'}
            </button>
            {revealed[index] && <p>{problem.answer}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}

function DailyFocusPlanMode({ content }) {
  const firstTerm = getVocabulary(content)[0]
  const firstActivity = content?.activities?.[0]
  const firstQuiz = content?.quiz?.[0]

  return (
    <section className="focus-plan">
      <div>
        <span>Read</span>
        <p>{content?.overview ? stripHtml(content.overview) : 'Review the lesson overview and first section.'}</p>
      </div>
      <div>
        <span>Practice</span>
        <p>{firstActivity ? `${firstActivity.title}: ${firstActivity.instructions}` : firstTerm ? `Explain ${firstTerm.term} and use it in an example.` : 'Write a three-sentence summary of the lesson.'}</p>
      </div>
      <div>
        <span>Quiz yourself</span>
        <p>{firstQuiz ? firstQuiz.question : firstTerm ? `What does ${firstTerm.term} mean?` : 'Name the most important idea from the lesson.'}</p>
      </div>
    </section>
  )
}

function LessonRenderer({ lesson, profile }) {
  const content = lesson?.content
  const [speaking, setSpeaking] = useState(false)
  const [activeMode, setActiveMode] = useState('interactive')
  const utteranceRef = useRef(null)
  const speechQueueRef = useRef([])
  const speechCancelledRef = useRef(false)

  useEffect(() => {
    setActiveMode('interactive')
  }, [lesson?.id])

  useEffect(() => {
    return () => {
      speechCancelledRef.current = true
      // Only cancel if actually speaking - calling cancel() on an idle
      // synthesis leaves Chrome in a broken state that silently drops the
      // next speak() call.
      if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  if (!content) {
    return <p className="sv-muted">Choose a lesson to see the adapted student version.</p>
  }

  const contentKey = [
    lesson.id,
    lesson.title,
    content.levelLabel,
    content.lexileRange,
    stripHtml(content.mainContent).slice(0, 120),
  ].filter(Boolean).join('|')

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
    if (!content.mainContent || !window.speechSynthesis) return

    // If translation failed the content is still English; use English voice.
    const effectiveLang = content._translationFailed ? 'en' : profile.language
    const raw = `${decodeHtml(content.overview)}\n\n${decodeHtml(content.mainContent)}`
    const chunks = chunkTextForSpeech(raw)
    if (chunks.length === 0) return

    const voice = findVoiceForLanguage(effectiveLang)
    const targetLang = getTtsLanguage(effectiveLang)

    const speakNext = () => {
      if (speechCancelledRef.current) return

      const nextText = speechQueueRef.current.shift()
      if (!nextText) {
        setSpeaking(false)
        utteranceRef.current = null
        return
      }

      const utterance = new SpeechSynthesisUtterance(nextText)
      if (voice) {
        utterance.voice = voice
        utterance.lang = voice.lang
      } else {
        utterance.lang = targetLang
      }

      utterance.onend = speakNext
      utterance.onerror = () => {
        setSpeaking(false)
        utteranceRef.current = null
      }
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    }

    speechCancelledRef.current = false
    speechQueueRef.current = chunks
    window.speechSynthesis.cancel()
    setSpeaking(true)
    setTimeout(speakNext, 50)
  }

  function stopSpeaking() {
    speechCancelledRef.current = true
    speechQueueRef.current = []
    window.speechSynthesis.cancel()
    utteranceRef.current = null
    setSpeaking(false)
  }

  function renderMode() {
    switch (activeMode) {
      case 'flashcards': return <FlashcardsMode content={content} />
      case 'cloze': return <ClozeMode content={content} />
      case 'quiz': return <QuizMode content={content} />
      case 'visual': return <VisualExplanationMode content={content} />
      case 'practice': return <PracticeProblemsMode content={content} />
      case 'plan': return <DailyFocusPlanMode content={content} />
      default: return <InteractiveLessonMode content={content} />
    }
  }

  return (
    <article className={articleClass}>
      <div className="student-status-row">
        <span>{lesson.title}</span>
        {lesson.appliedProfile?.readingLevel && (
          <span>Adapted - {formatReadingLevel(lesson.appliedProfile.readingLevel)}</span>
        )}
        {lesson.appliedProfile?.diagnosticReadingLevel && lesson.appliedProfile.readingLevel === lesson.appliedProfile.diagnosticReadingLevel && (
          <span>Diagnostic-updated reading level</span>
        )}
        <span>{translationStatusLabel}</span>
        {content._textOnly && <span>Text-only mode</span>}
        {content._translationFailed && <span>Showing original (translation unavailable)</span>}
      </div>

      {profile.ttsEnabled && (
        <button className="bf-btn" type="button" onClick={speaking ? stopSpeaking : speak}>
          {speaking ? 'Stop reading' : 'Read aloud'}
        </button>
      )}

      <div>
        <h2>{content.levelLabel || lesson.title}</h2>
        {content.lexileRange && <p className="sv-muted">{content.lexileRange}</p>}
      </div>

      <div className="lesson-mode-tabs" role="tablist" aria-label="Lesson learning modes">
        {LESSON_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={activeMode === mode.id}
            className={`pill ${activeMode === mode.id ? 'active' : ''}`}
            onClick={() => setActiveMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="lesson-mode-content">
        <div key={`${contentKey}:${activeMode}`}>
          {renderMode()}
        </div>
      </div>
    </article>
  )
}

async function loadPublishedStudentLessons() {
  const classResult = await getClasses('student')
  const classes = classResult.classes || []
  const lessons = (
    await Promise.all(classes.map(async (item) => {
      const result = await getLessonsByClass(item.id, 'student')
      return (result.lessons || []).map((lesson) => ({ ...lesson, className: item.name }))
    }))
  ).flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return { classes, lessons }
}

function LessonsTab() {
  const [classes, setClasses] = useState([])
  const [lessons, setLessons] = useState([])
  const [selectedLessonId, setSelectedLessonId] = useState(null)
  const [adaptedLesson, setAdaptedLesson] = useState(null)
  const [profile, setProfile] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)
  const [languages, setLanguages] = useState(DEFAULT_LANGUAGES)
  const [loading, setLoading] = useState(true)
  const [lessonLoading, setLessonLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [suggestedBandwidth, setSuggestedBandwidth] = useState(null)
  const [diagnosticResult, setDiagnosticResult] = useState(null)
  // Incremented after a profile save reaches the DB, so lesson reload reads the committed state
  const [lessonReloadTrigger, setLessonReloadTrigger] = useState(0)

  useBandwidthSuggestion(profile || {}, setSuggestedBandwidth)

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [profileResult, classResult, diagnosticsResult, languageResult] = await Promise.all([
          getProfile('student'),
          getClasses('student'),
          getMyDiagnosticSummary('student').catch(() => null),
          getTranslationLanguages('student').catch(() => DEFAULT_LANGUAGES),
        ])

        const loadedProfile = profileResult.profile
        const loadedClasses = classResult.classes || []
        setProfile(loadedProfile)
        setClasses(loadedClasses)
        setDiagnostics(diagnosticsResult)
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

  async function refreshDiagnosticContext() {
    try {
      const [profileResult, diagnosticsResult] = await Promise.all([
        getProfile('student'),
        getMyDiagnosticSummary('student').catch(() => null),
      ])
      setProfile(profileResult.profile)
      setDiagnostics(diagnosticsResult)
    } catch (err) {
      setError(err.message || 'Could not refresh learner profile.')
    }
  }

  useEffect(() => {
    setDiagnosticResult(null)
  }, [selectedLessonId])

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
        setDiagnosticResult(null)
      }
    }

    loadLesson()
    // lessonReloadTrigger only increments after the profile PUT has committed to DB,
    // so the server reads the correct state. profile is intentionally omitted here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLessonId, lessonReloadTrigger])

  async function changeProfile(updates) {
    if (!profile) return
    // Optimistic UI update — controls respond instantly (checkboxes, selects).
    // We do NOT use this to trigger a lesson reload; that waits for the DB commit.
    setProfile((prev) => ({ ...prev, ...updates }))
    setSaving(true)
    setSuggestedBandwidth(null)

    // Phase 3: log engagement events for telemetry. Fire-and-forget — no await.
    if (selectedLessonId) {
      if ('language' in updates) {
        logEngagementEvent({ lessonId: selectedLessonId, eventType: 'LANGUAGE_TOGGLE',
          metadata: { from: profile.language, to: updates.language } })
      }
      if ('bandwidthMode' in updates) {
        logEngagementEvent({ lessonId: selectedLessonId, eventType: 'BANDWIDTH_CHANGE',
          metadata: { from: profile.bandwidthMode, to: updates.bandwidthMode } })
      }
      if ('ttsEnabled' in updates) {
        logEngagementEvent({ lessonId: selectedLessonId, eventType: 'TTS_TOGGLE',
          metadata: { enabled: updates.ttsEnabled } })
      }
    }

    try {
      const result = await updateProfile(updates, 'student')
      setProfile(result.profile)
      // Only trigger lesson reload after profile is committed — avoids a flash
      // where the server adapts the lesson with the stale DB state.
      setLessonReloadTrigger((t) => t + 1)
    } catch (err) {
      setError(err.message || 'Could not save profile changes.')
      setProfile(profile) // revert optimistic update
    } finally {
      setSaving(false)
    }
  }

  function handleDiagnosticComplete(result) {
    setDiagnosticResult(result)
    setProfile((prev) => prev ? {
      ...prev,
      readingLevel: result.newReadingLevel,
      diagnosticReadingLevel: result.newReadingLevel,
    } : prev)
    // The diagnostic route already updates the DB before returning, so the
    // lesson reload will read the committed new level.
    setLessonReloadTrigger((t) => t + 1)
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
        {selectedLessonId && (
          <DiagnosticPanel
            key={selectedLessonId}
            lessonId={selectedLessonId}
            onComplete={handleDiagnosticComplete}
          />
        )}

        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
        <DiagnosticLauncher
          classes={classes}
          diagnostics={diagnostics}
          loading={lessonLoading}
          profile={profile}
          onComplete={refreshDiagnosticContext}
        />
        <DiagnosticSupportBanner profile={profile} lesson={adaptedLesson} diagnostics={diagnostics} />
        {lessonLoading ? (
          <p className="sv-muted">
            {diagnosticResult ? 'Applying adaptation...' : 'Adapting lesson for your profile...'}
          </p>
        ) : (
          <>
            <AdaptationBanner profile={profile} />
            <LessonRenderer lesson={adaptedLesson} profile={profile} />
          </>
        )}
      </main>
    </div>
  )
}

function AssignmentsTab() {
  const [done, setDone] = useState(new Set())
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadAssignments() {
      try {
        const result = await loadPublishedStudentLessons()
        if (!cancelled) setLessons(result.lessons)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load assignments.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAssignments()
    return () => { cancelled = true }
  }, [])

  function toggle(id) {
    setDone((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <p className="sv-muted">Loading assignments...</p>
  if (error) return <p style={{ color: '#fca5a5' }}>{error}</p>

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>Your published lesson tasks from all classes.</p>
      <ul className="sv-assignment-list">
        {lessons.map((lesson) => (
          <li key={lesson.id} className={`sv-assignment-item ${done.has(lesson.id) ? 'done' : ''}`}>
            <label className="sv-check-row">
              <input type="checkbox" checked={done.has(lesson.id)} onChange={() => toggle(lesson.id)} />
              <div>
                <strong>{lesson.title}</strong>
                <span>{lesson.className} - Published {new Date(lesson.publishedAt || lesson.createdAt).toLocaleDateString()}</span>
                <small className={`sv-badge ${done.has(lesson.id) ? '' : 'warn'}`}>
                  {done.has(lesson.id) ? 'Done' : 'Ready to review'}
                </small>
              </div>
            </label>
          </li>
        ))}
        {lessons.length === 0 && (
          <li className="sv-assignment-item">
            <strong>No published lesson tasks yet</strong>
            <span className="sv-muted">When your teacher publishes a lesson, it will appear here.</span>
          </li>
        )}
      </ul>
    </div>
  )
}

function PlannerTab() {
  const [done, setDone] = useState(new Set())
  const [lessons, setLessons] = useState([])

  useEffect(() => {
    let cancelled = false
    loadPublishedStudentLessons()
      .then((result) => { if (!cancelled) setLessons(result.lessons) })
      .catch(() => { if (!cancelled) setLessons([]) })
    return () => { cancelled = true }
  }, [])

  const days = useMemo(() => {
    const tasks = lessons.length > 0 ? lessons : [{ id: 'review', title: 'Review adapted lesson', className: 'Study plan' }]
    return Array.from({ length: Math.min(14, Math.max(7, tasks.length * 2)) }, (_, index) => {
      const day = new Date(TODAY)
      day.setDate(TODAY.getDate() + index)
      return {
        date: day,
        task: tasks[index % tasks.length],
        action: index % 2 === 0 ? 'Read' : 'Practice',
      }
    })
  }, [lessons])

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>A lesson-based plan keeps the next step clear.</p>
      <div className="sv-calendar">
        {days.map((item, index) => {
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
                <strong>{item.date.toLocaleDateString('en-US', { weekday: 'short' })}</strong>
                <span>{item.date.getMonth() + 1}/{item.date.getDate()}</span>
              </div>
              <div className="sv-cal-task">
                <span className="sv-type-dot" style={{ background: index % 2 ? '#60a5fa' : '#4ade80' }} />
                <span>{isDone ? <s>{item.action}: {item.task.title}</s> : `${item.action}: ${item.task.title}`}</span>
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
  const [progress, setProgress] = useState({ fuelPoints: 0, studySessions: 0, missedDays: 0 })

  useEffect(() => {
    let cancelled = false
    loadPublishedStudentLessons()
      .then((result) => {
        if (cancelled) return
        setProgress((prev) => ({
          ...prev,
          fuelPoints: result.lessons.length * 20,
          studySessions: result.lessons.length,
        }))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
