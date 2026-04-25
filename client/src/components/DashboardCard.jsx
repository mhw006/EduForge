export default function DashboardCard({ title, action, children }) {
  return (
    <article className="bf-card dashboard-card">
      <header className="card-header">
        <h3>{title}</h3>
        {action ? action : null}
      </header>
      <div>{children}</div>
    </article>
  )
}
