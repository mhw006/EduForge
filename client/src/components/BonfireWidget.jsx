function getFocusLevel(fuelPoints) {
  if (fuelPoints >= 350) return 'Wildfire Momentum'
  if (fuelPoints >= 220) return 'Blazing'
  if (fuelPoints >= 120) return 'Steady Flame'
  return 'Kindled'
}

function getMessage(fuelPoints, missedDays) {
  if (missedDays > 0) {
    return 'Your fire dimmed a little, but it is still alive. One session brings it back.'
  }
  if (fuelPoints >= 220) {
    return 'You are locked in. Keep stacking focused wins today.'
  }
  return 'Small focus sessions still count. Add fuel one task at a time.'
}

export default function BonfireWidget({ progress }) {
  const fuelPoints = progress?.fuelPoints ?? 0
  const studySessions = progress?.studySessions ?? 0
  const missedDays = progress?.missedDays ?? 0
  const flameSize = Math.max(28, Math.min(100, 30 + Math.round(fuelPoints * 0.2) + studySessions * 4 - missedDays * 3))
  const focusLevel = getFocusLevel(fuelPoints)
  const message = getMessage(fuelPoints, missedDays)

  return (
    <div className="bonfire-widget">
      <div className="bonfire-flame-wrap" aria-label="Current flame size">
        <span className="bonfire-glow" style={{ width: `${flameSize + 30}px`, height: `${flameSize + 30}px` }} />
        <span className="bonfire-flame" style={{ fontSize: `${flameSize}px` }}>
          🔥
        </span>
      </div>

      <div className="bonfire-stats">
        <p>
          <strong>{fuelPoints}</strong> Fuel Points
        </p>
        <p>
          <strong>{focusLevel}</strong> Focus Level
        </p>
        <p>
          <strong>{flameSize}%</strong> Flame Size
        </p>
      </div>

      <p className="bonfire-message">{message}</p>
    </div>
  )
}
