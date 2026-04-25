import { useMemo, useState } from 'react'
import BonfireWidget from '../components/BonfireWidget'

export default function BonfireProgress() {
  const [progress, setProgress] = useState({
    fuelPoints: 160,
    studySessions: 5,
    missedDays: 0,
  })

  const focusLevel = useMemo(() => {
    if (progress.fuelPoints > 300) return 'High Growth Momentum'
    if (progress.fuelPoints > 220) return 'On Track'
    if (progress.fuelPoints > 120) return 'Needs Reinforcement'
    return 'Intervention Recommended'
  }, [progress.fuelPoints])

  function completeTask() {
    setProgress((prev) => ({ ...prev, fuelPoints: prev.fuelPoints + 12 }))
  }

  function completeSession() {
    setProgress((prev) => ({
      ...prev,
      fuelPoints: prev.fuelPoints + 20,
      studySessions: prev.studySessions + 1,
    }))
  }

  function missDay() {
    setProgress((prev) => ({
      ...prev,
      fuelPoints: Math.max(20, prev.fuelPoints - 8),
      missedDays: prev.missedDays + 1,
    }))
  }

  return (
    <main className="page-wrap narrow">
      <header className="page-header single">
        <h1>Student Growth Tracker</h1>
        <p>Track momentum over time without punitive resets for off days.</p>
      </header>

      <section className="bf-card">
        <BonfireWidget progress={progress} />

        <div className="progress-controls">
          <button className="bf-btn" type="button" onClick={completeTask}>
            Mark Learning Task Complete (+12)
          </button>
          <button className="bf-btn" type="button" onClick={completeSession}>
            Mark Guided Session Complete (+20)
          </button>
          <button className="bf-btn ghost" type="button" onClick={missDay}>
            Missed Day (small decay only)
          </button>
        </div>

        <p className="progress-summary">
          Current level: <strong>{focusLevel}</strong> • Sessions completed: <strong>{progress.studySessions}</strong>
        </p>
      </section>
    </main>
  )
}
