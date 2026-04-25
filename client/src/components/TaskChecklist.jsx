export default function TaskChecklist({ tasks, onToggle }) {
  return (
    <ul className="task-checklist">
      {tasks.map((task) => (
        <li key={task.id} className={task.completed ? 'done' : ''}>
          <label>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => onToggle(task.id)}
            />
            <span>{task.task || task.title}</span>
          </label>

          <div className="task-meta">
            {task.estimatedMinutes ? <small>{task.estimatedMinutes} min</small> : null}
            {task.recommendedDay ? <small>{task.recommendedDay}</small> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
