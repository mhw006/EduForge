const modeConfig = {
  flashcards: 'Flashcards',
  fillInTheBlank: 'Fill-in-the-blank',
  kahootQuiz: 'Kahoot-style quiz',
  explainSimply: 'Explain-it-simply mode',
  practiceProblems: 'Practice problem mode',
}

export default function StudyModeSelector({ modes, selectedMode, onSelectMode }) {
  const keys = Object.keys(modeConfig)

  return (
    <div className="study-mode-selector">
      <div className="pill-row">
        {keys.map((key) => (
          <button
            type="button"
            key={key}
            className={selectedMode === key ? 'pill active' : 'pill'}
            onClick={() => onSelectMode(key)}
          >
            {modeConfig[key]}
          </button>
        ))}
      </div>

      <article className="bf-card mode-content">
        <h3>{modeConfig[selectedMode]}</h3>

        {selectedMode === 'flashcards' && (
          <ul>
            {(modes.flashcards || []).map((card) => (
              <li key={card.front}>
                <strong>Q:</strong> {card.front}
                <br />
                <strong>A:</strong> {card.back}
              </li>
            ))}
          </ul>
        )}

        {selectedMode === 'fillInTheBlank' && (
          <ol>
            {(modes.fillInTheBlank || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        )}

        {selectedMode === 'kahootQuiz' && (
          <ul>
            {(modes.kahootQuiz || []).map((q) => (
              <li key={q.question}>
                <strong>{q.question}</strong>
                <p>{q.options.join(' | ')}</p>
                <small>Answer: {q.answer}</small>
              </li>
            ))}
          </ul>
        )}

        {selectedMode === 'explainSimply' && <p>{modes.explainSimply}</p>}

        {selectedMode === 'practiceProblems' && (
          <ol>
            {(modes.practiceProblems || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        )}
      </article>
    </div>
  )
}
