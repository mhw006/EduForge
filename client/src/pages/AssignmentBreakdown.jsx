import { useState } from 'react'
import TaskChecklist from '../components/TaskChecklist'
import { generateAssignmentBreakdown } from '../services/aiClient'

export default function AssignmentBreakdown() {
  const [form, setForm] = useState({
    title: '',
    dueDate: '',
    description: '',
    difficulty: 'Medium',
  })
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const result = await generateAssignmentBreakdown(form)
      setPlan(result)
    } finally {
      setLoading(false)
    }
  }

  function toggleTask(taskId) {
    setPlan((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ),
      }
    })
  }

  return (
    <main className="page-wrap narrow">
      <header className="page-header single">
        <h1>Assignment Breakdown</h1>
        <p>Enter one assignment and Bonfire will instantly produce a clear execution plan.</p>
      </header>

      <section className="bf-card">
        <form className="form-grid" onSubmit={submit}>
          <label>
            Assignment title
            <input name="title" value={form.title} onChange={updateField} placeholder="Operating Systems Homework" required />
          </label>

          <label>
            Due date
            <input name="dueDate" value={form.dueDate} onChange={updateField} type="date" required />
          </label>

          <label>
            Estimated difficulty
            <select name="difficulty" value={form.difficulty} onChange={updateField}>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </label>

          <label className="full-width">
            Description
            <textarea name="description" value={form.description} onChange={updateField} placeholder="Problem set on CPU scheduling + process synchronization" />
          </label>

          <button className="bf-btn" type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Focus Plan'}
          </button>
        </form>
      </section>

      {plan ? (
        <section className="bf-card">
          <h2>{plan.assignmentTitle}</h2>
          <p>Due {plan.dueDate}</p>
          <TaskChecklist tasks={plan.tasks} onToggle={toggleTask} />
        </section>
      ) : null}
    </main>
  )
}
