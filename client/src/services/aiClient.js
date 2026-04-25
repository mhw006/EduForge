const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function handleResponse(response) {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Request failed')
  }
  return response.json()
}

export async function getDashboardData() {
  const response = await fetch(`${API_BASE}/dashboard`)
  return handleResponse(response)
}

export async function generateAssignmentBreakdown(assignment) {
  const response = await fetch(`${API_BASE}/assignment/breakdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignment),
  })

  return handleResponse(response)
}

export async function generateExamStudyPlan(exam) {
  const response = await fetch(`${API_BASE}/exam/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exam),
  })

  return handleResponse(response)
}

export async function generateStudyModes(topic) {
  const response = await fetch(`${API_BASE}/study/modes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  })

  return handleResponse(response)
}

export async function recommendNextFocusTask(userProgress) {
  const response = await fetch(`${API_BASE}/focus/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userProgress),
  })

  return handleResponse(response)
}
