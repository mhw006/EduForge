import { useEffect, useMemo, useRef, useState } from 'react'
import BonfireWidget from '../components/BonfireWidget'
import { adaptContent, getClasses, getLessonsByClass } from '../services/aiClient'

// ─── Tab IDs ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'curriculum', icon: '📚', label: 'Units & Curriculum' },
  { id: 'assignments', icon: '📝', label: 'Assignments' },
  { id: 'fun-center', icon: '🎮', label: 'Fun Center' },
  { id: 'planner', icon: '📅', label: 'Study Planner' },
  { id: 'bonfire', icon: '🔥', label: 'My Bonfire' },
]

// ─── Key terms to highlight (demo set, would come from lesson in prod) ───────
const HIGHLIGHT_TERMS = [
  'fraction', 'numerator', 'denominator', 'equation', 'variable',
  'hypothesis', 'evidence', 'synthesis', 'inference', 'metaphor',
]

function highlightText(text, terms) {
  if (!text || !terms.length) return text
  const regex = new RegExp(`\\b(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  const parts = []
  let last = 0
  let match
  const clone = new RegExp(regex.source, regex.flags)
  while ((match = clone.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(<mark key={match.index} className="sv-highlight">{match[0]}</mark>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

// ─── Curriculum tab ──────────────────────────────────────────────────────────
function CurriculumTab() {
  const [classes, setClasses] = useState([])
  const [lessons, setLessons] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const cr = await getClasses()
        const cls = cr?.classes || []
        setClasses(cls)
        if (cls.length === 0) return

        const allLessons = (
          await Promise.all(cls.map(async c => {
            const lr = await getLessonsByClass(c.id)
            return (lr?.lessons || []).map(l => ({ ...l, className: c.name }))
          }))
        ).flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        setLessons(allLessons)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <p className="sv-muted">Loading lessons…</p>
  if (lessons.length === 0) return <p className="sv-muted">No lessons published by your teacher yet.</p>

  const active = selected ? lessons.find(l => l.id === selected) : null

  return (
    <div className="sv-two-col">
      <ul className="sv-lesson-list">
        {lessons.map(l => (
          <li
            key={l.id}
            className={`sv-lesson-item ${selected === l.id ? 'active' : ''}`}
            onClick={() => setSelected(l.id)}
          >
            <strong>{l.title}</strong>
            <span>{l.className}</span>
            <small>{new Date(l.createdAt).toLocaleDateString()}</small>
          </li>
        ))}
      </ul>

      <div className="sv-lesson-detail">
        {active ? (
          <>
            <h2>{active.title}</h2>
            <p className="sv-muted">{active.standard}</p>
            <p className="sv-muted">Class: {active.className} · Saved {new Date(active.createdAt).toLocaleDateString()}</p>
            <p style={{ marginTop: '1rem' }}>Select this lesson from your teacher's queue. Use the <strong>Fun Center</strong> tab to read it with TTS, language support, and highlighted key terms.</p>
          </>
        ) : (
          <p className="sv-muted">Select a lesson to view details.</p>
        )}
      </div>
    </div>
  )
}

// ─── Assignments tab ─────────────────────────────────────────────────────────
const SAMPLE_ASSIGNMENTS = [
  { id: 'a1', title: 'Fractions Quiz — Unit 3', due: '2026-04-28', status: 'Due soon', course: 'Math' },
  { id: 'a2', title: 'Textual Evidence Paragraph', due: '2026-04-30', status: 'Not started', course: 'ELA' },
  { id: 'a3', title: 'Cell Diagram Labeling', due: '2026-05-02', status: 'In progress', course: 'Science' },
  { id: 'a4', title: 'Chapter 4 Vocabulary', due: '2026-05-05', status: 'Not started', course: 'ELA' },
]

function AssignmentsTab() {
  const [done, setDone] = useState(new Set())
  function toggle(id) {
    setDone(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>Your upcoming assignments from all classes.</p>
      <ul className="sv-assignment-list">
        {SAMPLE_ASSIGNMENTS.map(a => (
          <li key={a.id} className={`sv-assignment-item ${done.has(a.id) ? 'done' : ''}`}>
            <label className="sv-check-row">
              <input type="checkbox" checked={done.has(a.id)} onChange={() => toggle(a.id)} />
              <div>
                <strong>{a.title}</strong>
                <span>{a.course} · Due {a.due}</span>
                <small className={`sv-badge ${a.status === 'Due soon' ? 'warn' : ''}`}>{a.status}</small>
              </div>
            </label>
          </li>
        ))}
      </ul>
      <p className="sv-muted" style={{ marginTop: '1rem' }}>
        {done.size}/{SAMPLE_ASSIGNMENTS.length} completed
      </p>
    </div>
  )
}

// ─── Fun Center tab ──────────────────────────────────────────────────────────
const LANGUAGES = ['English', 'Spanish', 'Mandarin', 'Tagalog', 'Arabic', 'Vietnamese', 'Korean', 'French', 'Hindi', 'Somali']

function FunCenterTab() {
  const [topic, setTopic] = useState('')
  const [language, setLanguage] = useState('English')
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ttsActive, setTtsActive] = useState(false)
  const utteranceRef = useRef(null)

  async function load(e) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    setContent(null)
    try {
      const result = await adaptContent(topic, {
        readingLevel: 'Grade 6-8',
        language,
        dyslexiaFont: false,
        highContrast: false,
        screenReader: false,
        bandwidth: 'full-media',
      })
      setContent(result)
    } catch (err) {
      setError(err.message || 'Could not load content. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function speak() {
    if (!content?.mainContent) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(content.mainContent)
    utter.lang = language === 'Spanish' ? 'es-ES' : language === 'French' ? 'fr-FR' : language === 'Mandarin' ? 'zh-CN' : 'en-US'
    utteranceRef.current = utter
    setTtsActive(true)
    utter.onend = () => setTtsActive(false)
    window.speechSynthesis.speak(utter)
  }

  function stopSpeak() {
    window.speechSynthesis.cancel()
    setTtsActive(false)
  }

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>Type a topic or paste lesson text below — get it adapted to your language, with key terms highlighted and read aloud.</p>

      <form className="sv-inline-form" onSubmit={load}>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Enter a topic or paste lesson text…"
          required
        />
        <select value={language} onChange={e => setLanguage(e.target.value)}>
          {LANGUAGES.map(l => <option key={l}>{l}</option>)}
        </select>
        <button className="bf-btn" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Load Content'}
        </button>
      </form>

      {error && <p style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</p>}

      {content && (
        <div className="sv-fun-output">
          <div className="sv-fun-toolbar">
            <button className="bf-btn" type="button" onClick={ttsActive ? stopSpeak : speak}>
              {ttsActive ? '⏹ Stop Reading' : '🔊 Read Aloud'}
            </button>
            <span className="sv-muted">Language: <strong>{language}</strong></span>
          </div>

          <h2>{content.adaptedTitle}</h2>
          <div className="sv-fun-body">
            {highlightText(content.mainContent, HIGHLIGHT_TERMS)}
          </div>

          {content.keyTerms?.length > 0 && (
            <div className="sv-terms">
              <h4>Key terms to know</h4>
              <ul className="item-list compact">
                {content.keyTerms.map(t => (
                  <li key={t.term}>
                    <strong className="sv-highlight-term">{t.term}</strong>
                    <small>{t.definition}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Study Planner tab ───────────────────────────────────────────────────────
const TODAY = new Date('2026-04-25')

function buildCalendar() {
  const days = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(TODAY)
    d.setDate(TODAY.getDate() + i)
    days.push(d)
  }
  return days
}

const PLAN_ITEMS = [
  { day: 0, task: 'Review Unit 3 vocabulary', type: 'vocab' },
  { day: 1, task: 'Read lesson: Fractions as division', type: 'read' },
  { day: 2, task: 'Practice problems (foundational set)', type: 'practice' },
  { day: 3, task: '🔥 Bonfire check-in — track your streak', type: 'bonfire' },
  { day: 4, task: 'Quiz prep: Textual Evidence paragraph', type: 'quiz' },
  { day: 5, task: 'Fun Center — listen to adapted lesson', type: 'fun' },
  { day: 6, task: 'Rest day — light review only', type: 'rest' },
  { day: 7, task: 'Review missed problems', type: 'practice' },
  { day: 8, task: 'Cell Diagram labeling activity', type: 'practice' },
  { day: 9, task: 'Chapter 4 vocabulary flashcards', type: 'vocab' },
  { day: 10, task: 'Write draft paragraph with evidence', type: 'read' },
  { day: 11, task: '🔥 Bonfire check-in', type: 'bonfire' },
  { day: 12, task: 'Self-quiz on all units', type: 'quiz' },
  { day: 13, task: 'Free study + ask teacher questions', type: 'rest' },
]

const TYPE_COLOR = {
  vocab: '#a78bfa',
  read: '#60a5fa',
  practice: '#4ade80',
  quiz: '#fb923c',
  fun: '#f472b6',
  bonfire: '#ff9f43',
  rest: '#94a3b8',
}

function PlannerTab() {
  const [done, setDone] = useState(new Set())
  const days = useMemo(buildCalendar, [])

  function toggle(day) {
    setDone(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>Your AI-generated 14-day study plan — broken into daily tasks so nothing feels overwhelming.</p>
      <div className="sv-calendar">
        {days.map((d, i) => {
          const item = PLAN_ITEMS[i]
          const isDone = done.has(i)
          const isToday = i === 0
          return (
            <div
              key={i}
              className={`sv-cal-day ${isDone ? 'done' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => toggle(i)}
            >
              <div className="sv-cal-date">
                <strong>{d.toLocaleDateString('en-US', { weekday: 'short' })}</strong>
                <span>{d.getMonth() + 1}/{d.getDate()}</span>
              </div>
              <div className="sv-cal-task">
                <span className="sv-type-dot" style={{ background: TYPE_COLOR[item?.type] }} />
                <span>{isDone ? <s>{item?.task}</s> : item?.task}</span>
              </div>
              {isToday && <span className="sv-today-badge">Today</span>}
              {isDone && <span className="sv-done-badge">✓</span>}
            </div>
          )
        })}
      </div>
      <p className="sv-muted" style={{ marginTop: '1rem' }}>
        {done.size}/14 days checked off
      </p>
    </div>
  )
}

// ─── Bonfire tab ─────────────────────────────────────────────────────────────
function BonfireTab() {
  const [progress, setProgress] = useState({ fuelPoints: 160, studySessions: 5, missedDays: 0 })

  const focusLevel = useMemo(() => {
    if (progress.fuelPoints > 300) return 'High Growth Momentum'
    if (progress.fuelPoints > 220) return 'On Track'
    if (progress.fuelPoints > 120) return 'Needs Reinforcement'
    return 'Intervention Recommended'
  }, [progress.fuelPoints])

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>Your personal flame grows every time you study. Missing days only causes a small dip — your progress is never erased.</p>
      <div className="bf-card" style={{ maxWidth: '480px' }}>
        <BonfireWidget progress={progress} />
        <div className="progress-controls" style={{ marginTop: '1rem' }}>
          <button className="bf-btn" type="button" onClick={() => setProgress(p => ({ ...p, fuelPoints: p.fuelPoints + 12 }))}>
            ✅ Complete a Task (+12)
          </button>
          <button className="bf-btn" type="button" onClick={() => setProgress(p => ({ ...p, fuelPoints: p.fuelPoints + 20, studySessions: p.studySessions + 1 }))}>
            🎯 Complete a Session (+20)
          </button>
          <button className="bf-btn ghost" type="button" onClick={() => setProgress(p => ({ ...p, fuelPoints: Math.max(20, p.fuelPoints - 8), missedDays: p.missedDays + 1 }))}>
            😴 Missed Day (small decay)
          </button>
        </div>
        <p style={{ marginTop: '1rem' }}>
          Current level: <strong>{focusLevel}</strong> · Sessions: <strong>{progress.studySessions}</strong>
        </p>
      </div>
    </div>
  )
}

// ─── Main StudentView shell ──────────────────────────────────────────────────
export default function StudentView() {
  const [activeTab, setActiveTab] = useState('curriculum')

  function renderTab() {
    switch (activeTab) {
      case 'curriculum':   return <CurriculumTab />
      case 'assignments':  return <AssignmentsTab />
      case 'fun-center':   return <FunCenterTab />
      case 'planner':      return <PlannerTab />
      case 'bonfire':      return <BonfireTab />
      default:             return null
    }
  }

  const current = TABS.find(t => t.id === activeTab)

  return (
    <div className="sv-shell">
      {/* Left sidebar */}
      <nav className="sv-sidebar">
        <p className="sv-sidebar-label">Student View</p>
        {TABS.map(tab => (
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

      {/* Main content */}
      <main className="sv-content">
        <header className="sv-content-header">
          <h1>{current?.icon} {current?.label}</h1>
        </header>
        {renderTab()}
      </main>
    </div>
  )
}
