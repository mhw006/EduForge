const DIAGNOSTIC_DOMAINS = ['READING', 'MATH'];

const QUESTION_SETS = {
  READING: {
    key: 'reading-v1',
    domain: 'READING',
    title: 'Reading Foundations Diagnostic',
    description: 'Quick reading comprehension and vocabulary check to estimate the best support tier.',
    questions: [
      {
        id: 'reading-1',
        prompt: 'Which sentence best states the main idea of a short passage?',
        options: [
          { id: 'A', text: 'A small detail from the first paragraph' },
          { id: 'B', text: 'The central message that the whole passage supports' },
          { id: 'C', text: 'A word that repeats several times' },
          { id: 'D', text: 'The title only' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'reading-2',
        prompt: 'If a character slammed the door and crossed their arms, what is the best inference?',
        options: [
          { id: 'A', text: 'They are probably upset' },
          { id: 'B', text: 'They are going to sleep' },
          { id: 'C', text: 'They forgot their homework' },
          { id: 'D', text: 'They are hungry' },
        ],
        correctOptionId: 'A',
      },
      {
        id: 'reading-3',
        prompt: 'What does context clue mean?',
        options: [
          { id: 'A', text: 'A footnote at the bottom of a page' },
          { id: 'B', text: 'A clue around an unknown word that helps define it' },
          { id: 'C', text: 'A sentence copied from a dictionary' },
          { id: 'D', text: 'A title written in bold' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'reading-4',
        prompt: 'Which piece of evidence best supports a claim about a text?',
        options: [
          { id: 'A', text: 'A direct quote from the passage' },
          { id: 'B', text: 'A guess from memory' },
          { id: 'C', text: 'A classmate opinion' },
          { id: 'D', text: 'A random internet fact' },
        ],
        correctOptionId: 'A',
      },
      {
        id: 'reading-5',
        prompt: 'A summary should include:',
        options: [
          { id: 'A', text: 'Every single sentence from the text' },
          { id: 'B', text: 'Only your personal opinion' },
          { id: 'C', text: 'The most important ideas in your own words' },
          { id: 'D', text: 'Only unfamiliar vocabulary words' },
        ],
        correctOptionId: 'C',
      },
    ],
  },
  MATH: {
    key: 'math-v1',
    domain: 'MATH',
    title: 'Math Readiness Diagnostic',
    description: 'Quick multi-skill check for number sense, problem solving, and explanation readiness.',
    questions: [
      {
        id: 'math-1',
        prompt: 'What is 3/4 written as a decimal?',
        options: [
          { id: 'A', text: '0.34' },
          { id: 'B', text: '0.75' },
          { id: 'C', text: '1.25' },
          { id: 'D', text: '0.43' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'math-2',
        prompt: 'A student solved 18 + 27 by making 20 + 25. What strategy are they using?',
        options: [
          { id: 'A', text: 'Compensation' },
          { id: 'B', text: 'Graphing' },
          { id: 'C', text: 'Long division' },
          { id: 'D', text: 'Guess and check only' },
        ],
        correctOptionId: 'A',
      },
      {
        id: 'math-3',
        prompt: 'Which equation represents “five less than twice a number is 17”?',
        options: [
          { id: 'A', text: '2x + 5 = 17' },
          { id: 'B', text: '5 - 2x = 17' },
          { id: 'C', text: '2x - 5 = 17' },
          { id: 'D', text: '17 - 5 = 2x + 5' },
        ],
        correctOptionId: 'C',
      },
      {
        id: 'math-4',
        prompt: 'What is the area of a rectangle with length 8 and width 3?',
        options: [
          { id: 'A', text: '11' },
          { id: 'B', text: '24' },
          { id: 'C', text: '16' },
          { id: 'D', text: '48' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'math-5',
        prompt: 'Why is showing work useful in math?',
        options: [
          { id: 'A', text: 'It helps explain reasoning and catch mistakes' },
          { id: 'B', text: 'It always makes the answer longer' },
          { id: 'C', text: 'It replaces the final answer' },
          { id: 'D', text: 'It is only needed in geometry' },
        ],
        correctOptionId: 'A',
      },
    ],
  },
};

function getDiagnosticCatalog() {
  return Object.values(QUESTION_SETS).map((set) => ({
    domain: set.domain,
    key: set.key,
    title: set.title,
    description: set.description,
    totalQuestions: set.questions.length,
  }));
}

function getQuestionSet(domain) {
  const normalizedDomain = String(domain || '').toUpperCase();
  const questionSet = QUESTION_SETS[normalizedDomain];
  if (!questionSet) {
    throw new Error(`Unsupported diagnostic domain: ${domain}`);
  }

  return {
    ...questionSet,
    questions: questionSet.questions.map(({ correctOptionId, ...question }) => question),
  };
}

function inferReadingLevel(percent) {
  if (percent < 40) return 'FOUNDATIONAL';
  if (percent < 80) return 'GRADE_LEVEL';
  return 'ADVANCED';
}

function inferMathLevel(percent) {
  if (percent < 40) return 'BELOW_GRADE';
  if (percent < 80) return 'GRADE_LEVEL';
  return 'ADVANCED';
}

function buildRecommendedProfilePatch(domain, inferredLevel) {
  if (domain === 'READING') {
    return {
      diagnosticReadingLevel: inferredLevel,
      readingLevel: inferredLevel,
      preferredContentFormat: inferredLevel === 'FOUNDATIONAL' ? 'TEXT_FOCUSED' : 'MIXED_MEDIA',
    };
  }

  return {
    diagnosticMathLevel: inferredLevel,
    mathLevel: inferredLevel,
  };
}

function scoreDiagnostic(domain, responses) {
  const normalizedDomain = String(domain || '').toUpperCase();
  const questionSet = QUESTION_SETS[normalizedDomain];
  if (!questionSet) {
    throw new Error(`Unsupported diagnostic domain: ${domain}`);
  }

  const responseMap = new Map(
    Array.isArray(responses)
      ? responses.map((response) => [response.questionId, String(response.selectedOptionId || '').toUpperCase()])
      : []
  );

  const gradedResponses = questionSet.questions.map((question) => {
    const selectedOptionId = responseMap.get(question.id) || null;
    const correct = selectedOptionId === question.correctOptionId;
    return {
      questionId: question.id,
      selectedOptionId,
      correctOptionId: question.correctOptionId,
      correct,
    };
  });

  const score = gradedResponses.filter((response) => response.correct).length;
  const totalQuestions = questionSet.questions.length;
  const percent = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  const inferredLevel =
    normalizedDomain === 'READING'
      ? inferReadingLevel(percent)
      : inferMathLevel(percent);

  const recommendedProfilePatch = buildRecommendedProfilePatch(normalizedDomain, inferredLevel);

  return {
    domain: normalizedDomain,
    questionSetKey: questionSet.key,
    score,
    totalQuestions,
    percent,
    responses: gradedResponses,
    inferredReadingLevel: normalizedDomain === 'READING' ? inferredLevel : null,
    inferredMathLevel: normalizedDomain === 'MATH' ? inferredLevel : null,
    recommendedProfilePatch,
  };
}

module.exports = {
  DIAGNOSTIC_DOMAINS,
  getDiagnosticCatalog,
  getQuestionSet,
  scoreDiagnostic,
};
