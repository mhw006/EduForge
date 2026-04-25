import { useState } from 'react'
import { generateExamStudyPlan } from '../services/aiClient'

const defaultTopics = [
  { name: 'Deadlocks', confidence: 2 },
  { name: 'CPU Scheduling', confidence: 3 },
  { name: 'Memory Management', confidence: 4 },
]

export default function ExamFocus() {
  const [name, setName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [topics, setTopics] = useState(defaultTopics)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)

  function updateTopic(index, key, value) {
    setTopics((prev) =>
      prev.map((topic, i) => (i === index ? { ...topic, [key]: value } : topic))
    )
  }

  function addTopic() {
    setTopics((prev) => [...prev, { name: '', confidence: 3 }])
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const result = await generateExamStudyPlan({
        name,
        examDate,
        topics: topics.filter((topic) => topic.name.trim()),
      })
      setPlan(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-wrap narrow">
      <header className="page-header single">
        <h1>Exam Focus</h1>
        <p>Generate a topic-priority study schedule from confidence ratings.</p>
      </header>

      <section className="bf-card">
        <form className="form-grid" onSubmit={submit}>
          <label>
            Exam name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Data Structures Midterm" required />
          </label>

          <label>
            Exam date
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
          </label>

          <div className="full-width">
            <div className="stack-header">
              <h3>Topics + confidence</h3>
              <button className="bf-btn ghost" type="button" onClick={addTopic}>Add Topic</button>
            </div>
            <div className="topic-grid">
              {topics.map((topic, index) => (
                <div className="topic-row" key={`${index}-${topic.name}`}>
                  <input
                    value={topic.name}
                    placeholder="Topic"
                    onChange={(e) => updateTopic(index, 'name', e.target.value)}
                  />
                  <label>
                    Confidence: {topic.confidence}
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={topic.confidence}
                      onChange={(e) => updateTopic(index, 'confidence', Number(e.target.value))}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <button className="bf-btn" type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Focus Plan'}
          </button>
        </form>
      </section>

      {plan ? (
        <section className="bf-card">
          <h2>{plan.examName} Study Plan</h2>

          <h3>Daily schedule</h3>
          <ul className="item-list compact">
            {plan.dailySchedule.map((day) => (
              <li key={`${day.day}-${day.focus}`}>
                <strong>{day.day}</strong>
                <span>{day.focus}</span>
                <small>{day.minutes} min</small>
              </li>
            ))}
          </ul>

          <h3>Topic priority + mode</h3>
          <ul className="item-list compact">
            {plan.topicPriority.map((topic) => (
              <li key={topic.topic}>
                <strong>{topic.topic}</strong>
                <span>Confidence {topic.confidence} / 5</span>
                <small>{topic.priority} priority • {topic.recommendedMode}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
