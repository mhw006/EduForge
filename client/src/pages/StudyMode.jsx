import { useState } from 'react'
import StudyModeSelector from '../components/StudyModeSelector'
import { generateStudyModes } from '../services/aiClient'

export default function StudyMode() {
  const [topic, setTopic] = useState('Deadlocks')
  const [selectedMode, setSelectedMode] = useState('flashcards')
  const [modes, setModes] = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const result = await generateStudyModes(topic)
      setModes(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-wrap narrow">
      <header className="page-header single">
        <h1>Study Mode</h1>
        <p>Practice the same topic through multiple learning modes.</p>
      </header>

      <section className="bf-card">
        <form className="inline-form" onSubmit={submit}>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter topic"
          />
          <button className="bf-btn" type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Study Modes'}
          </button>
        </form>
      </section>

      {modes ? (
        <StudyModeSelector
          modes={modes}
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
        />
      ) : null}
    </main>
  )
}
