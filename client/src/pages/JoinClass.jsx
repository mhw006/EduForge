import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { joinClass } from '../services/aiClient'

/**
 * /join?code=XXX — auto-enroll a student into a class via shareable invite link.
 * If no code present in the URL, shows a manual paste-the-code form.
 */
export default function JoinClass() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initialCode = params.get('code') || ''

  const [code, setCode] = useState(initialCode)
  const [status, setStatus] = useState(initialCode ? 'pending' : 'idle')
  const [error, setError] = useState(null)
  const [joined, setJoined] = useState(null)

  // Auto-attempt join if a code was passed in the URL
  useEffect(() => {
    if (!initialCode) return
    let cancelled = false
    async function go() {
      try {
        const result = await joinClass(initialCode)
        if (!cancelled) { setJoined(result); setStatus('success') }
      } catch (err) {
        if (!cancelled) {
          // 409 = already enrolled — treat as success
          if (/already enrolled/i.test(err.message || '')) {
            setStatus('success')
            setJoined({ className: 'this class', alreadyEnrolled: true })
          } else {
            setError(err.message || 'Could not join class.')
            setStatus('error')
          }
        }
      }
    }
    go()
    return () => { cancelled = true }
  }, [initialCode])

  async function submitManual(e) {
    e.preventDefault()
    if (!code.trim()) return
    setStatus('pending'); setError(null)
    try {
      const result = await joinClass(code.trim())
      setJoined(result)
      setStatus('success')
    } catch (err) {
      if (/already enrolled/i.test(err.message || '')) {
        setStatus('success')
        setJoined({ className: 'this class', alreadyEnrolled: true })
      } else {
        setError(err.message || 'Could not join class.')
        setStatus('error')
      }
    }
  }

  return (
    <main className="page-wrap" style={{ maxWidth: '560px', margin: '40px auto' }}>
      <section className="bf-card">
        <h1 style={{ marginTop: 0 }}>Join a class</h1>

        {status === 'success' && joined && (
          <>
            <p style={{ color: '#4ade80' }}>
              {joined.alreadyEnrolled
                ? `You're already in ${joined.className}.`
                : `You joined ${joined.className}.`}
            </p>
            <p className="sv-muted">Open the student view to see your lessons.</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="bf-btn"
                onClick={() => navigate('/student')}
              >
                Go to Student View
              </button>
              <Link to="/" className="bf-btn ghost">Back to home</Link>
            </div>
          </>
        )}

        {status !== 'success' && (
          <>
            <p className="sv-muted" style={{ marginBottom: '1rem' }}>
              Paste the join code your teacher shared with you, or open the invite link they sent.
            </p>
            <form onSubmit={submitManual} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Class join code"
                style={{ flex: 1 }}
                autoFocus
              />
              <button
                type="submit"
                className="bf-btn"
                disabled={status === 'pending' || !code.trim()}
              >
                {status === 'pending' ? 'Joining…' : 'Join'}
              </button>
            </form>
            {error && <p style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</p>}
          </>
        )}
      </section>
    </main>
  )
}
