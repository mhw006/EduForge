const navItems = [
  'Home',
  'My Courses',
  'AI Tutor',
  'Assignments',
  'Study Tools',
  'Progress',
  'Bonfire',
  'Leaderboard',
  'Resources',
]

const learningCards = [
  {
    title: 'Data Structures',
    badge: 'In Progress',
    progress: 65,
    next: 'Trees',
    tone: 'lavender',
  },
  {
    title: 'Operating Systems',
    badge: 'In Progress',
    progress: 40,
    next: 'CPU Scheduling',
    tone: 'blue',
  },
  {
    title: 'Linear Algebra',
    badge: 'Not Started',
    progress: 0,
    next: 'Matrices',
    tone: 'green',
  },
]

const recommendationCards = [
  {
    title: 'Dynamic Programming',
    subtitle: 'Master DP with real-life problem solving.',
    action: 'Practice',
    tone: 'amber',
  },
  {
    title: 'Time Complexity',
    subtitle: 'Understand Big O notation visually.',
    action: 'Concept',
    tone: 'cobalt',
  },
  {
    title: 'Recursion (Deep Dive)',
    subtitle: 'Break down recursion step-by-step.',
    action: 'Lesson',
    tone: 'violet',
  },
]

const assignments = [
  {
    title: 'Binary Tree Implementation',
    course: 'Data Structures',
    due: 'Due in 2 days',
  },
  {
    title: 'Process Scheduling Simulation',
    course: 'Operating Systems',
    due: 'Due in 4 days',
  },
  {
    title: 'Matrix Transformations',
    course: 'Linear Algebra',
    due: 'Due in 7 days',
  },
]

const community = [
  {
    name: 'Study Group: Algorithms',
    members: '23 members online',
  },
  {
    name: 'System Design Discussion',
    members: '15 members online',
  },
]

export default function Home() {
  return (
    <main className="dashboard-page">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />

      <div className="dashboard-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-logo">🔥</div>
            <div>
              <h2>Bonfire</h2>
              <p>Fuel Your Knowledge</p>
            </div>
          </div>

          <nav className="nav-list" aria-label="Main navigation">
            {navItems.map((item, index) => (
              <button
                type="button"
                key={item}
                className={`nav-item ${index === 0 ? 'active' : ''}`}
              >
                <span className="nav-dot" />
                <span>{item}</span>
              </button>
            ))}
          </nav>

          <div className="upload-card">
            <h3>✨ New</h3>
            <p>Upload your lecture notes, slides, or PDFs and turn them into study tools.</p>
            <button type="button">Upload Now</button>
          </div>
        </aside>

        <section className="main-column">
          <header className="top-bar">
            <label className="search" htmlFor="search-input">
              <span>⌕</span>
              <input id="search-input" placeholder="Search for topics, courses, or resources..." />
              <kbd>Ctrl K</kbd>
            </label>

            <div className="top-actions">
              <button type="button" className="streak-pill">
                🔥 12 day streak
              </button>
              <button type="button" className="icon-btn" aria-label="Notifications">
                🔔
              </button>
              <button type="button" className="profile-pill">
                <span className="avatar">A</span>
                Alex Johnson
              </button>
            </div>
          </header>

          <article className="hero-card">
            <div className="hero-copy">
              <h1>Welcome back, Alex! 👋</h1>
              <p>Ready to keep your bonfire burning?</p>

              <div className="xp-card">
                <p className="xp-title">Your Bonfire</p>
                <h3>Level 7 - Blazing</h3>
                <small>Keep going! You are on fire.</small>
                <div className="xp-track">
                  <span style={{ width: '62%' }} />
                </div>
                <strong>1,250 / 2,000 XP</strong>
              </div>
            </div>

            <div className="hero-art" role="img" aria-label="Campfire study vibe">
              <div className="moon" />
              <div className="flame">🔥</div>
              <div className="spark spark-a" />
              <div className="spark spark-b" />
              <div className="spark spark-c" />
              <div className="camp-silhouette" />
            </div>
          </article>

          <section className="section-block">
            <div className="section-head">
              <h2>Continue Learning</h2>
            </div>

            <div className="learning-grid">
              {learningCards.map((card) => (
                <article key={card.title} className={`learn-card ${card.tone}`}>
                  <p className="badge">{card.badge}</p>
                  <h3>{card.title}</h3>
                  <div className="progress-track">
                    <span style={{ width: `${card.progress}%` }} />
                  </div>
                  <div className="learn-foot">
                    <small>Next: {card.next}</small>
                    <strong>{card.progress}%</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-head">
              <h2>Recommended for You</h2>
              <button type="button">View all</button>
            </div>

            <div className="recommend-grid">
              {recommendationCards.map((card) => (
                <article key={card.title} className={`rec-card ${card.tone}`}>
                  <h3>{card.title}</h3>
                  <p>{card.subtitle}</p>
                  <strong>{card.action}</strong>
                </article>
              ))}
            </div>
          </section>

          <blockquote className="quote-card">
            <span>“</span>
            The beautiful thing about learning is that no one can take it away from you.
            <cite> - B.B. King</cite>
          </blockquote>
        </section>

        <aside className="right-rail">
          <article className="tutor-card">
            <h3>Your AI Tutor</h3>
            <div className="tutor-orb">🤖</div>
            <p>Hey Alex! What would you like to learn or review today?</p>
            <button type="button">Chat with Tutor</button>
          </article>

          <article className="panel-card">
            <div className="panel-head">
              <h3>Upcoming Assignments</h3>
            </div>
            <ul>
              {assignments.map((item) => (
                <li key={item.title}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.course}</small>
                  </div>
                  <span>{item.due}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="ghost-link">
              View All Assignments
            </button>
          </article>

          <article className="panel-card">
            <div className="panel-head">
              <h3>Bonfire Community</h3>
            </div>
            <ul>
              {community.map((item) => (
                <li key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.members}</small>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </div>
    </main>
  )
}
