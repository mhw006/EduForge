import { useMemo, useState } from 'react'
import BonfireWidget from '../components/BonfireWidget'

export default function BonfireProgress() {
  const [progress, setProgress] = useState({
    fuelPoints: 160,
    studySessions: 5,
    missedDays: 0,
  })

  const focusLevel = useMemo(() => {
    if (progress.fuelPoints > 300) return 'Wildfire Momentum'
    if (progress.fuelPoints > 220) return 'Blazing'
    if (progress.fuelPoints > 120) return 'Steady Flame'
    return 'Kindled'
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
        <h1>Bonfire Progress</h1>
        <p>Your flame can dim, but it never fully goes out.</p>
      </header>

      <section className="bf-card">
        <BonfireWidget progress={progress} />

        <div className="progress-controls">
          <button className="bf-btn" type="button" onClick={completeTask}>
            Complete Task (+12 fuel)
          </button>
          <button className="bf-btn" type="button" onClick={completeSession}>
            Complete Study Session (+20 fuel)
          </button>
          <button className="bf-btn ghost" type="button" onClick={missDay}>
            Miss Day (dim slightly)
          </button>
        </div>

        <p className="progress-summary">
          Current level: <strong>{focusLevel}</strong> • Sessions completed: <strong>{progress.studySessions}</strong>
        </p>
      </section>
    </main>
  )
}
