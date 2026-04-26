const DIAGNOSTIC_DOMAINS = ['READING', 'MATH'];

const QUESTION_SETS = {
  READING: {
    key: 'reading-v2',
    domain: 'READING',
    title: 'Reading Diagnostic',
    description: 'A 13-question check that mixes vocabulary, comprehension, inference, and analysis. Takes about 8 minutes.',
    questions: [
      // ── Easy: vocabulary & explicit recall ─────────────────────────────────
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
        prompt: 'What does it mean to "summarize" a text?',
        options: [
          { id: 'A', text: 'Copy every sentence word for word' },
          { id: 'B', text: 'Tell only your favorite part' },
          { id: 'C', text: 'Give the key ideas in a shorter form' },
          { id: 'D', text: 'Make up a new ending' },
        ],
        correctOptionId: 'C',
      },
      {
        id: 'reading-3',
        prompt: 'A "context clue" is best described as:',
        options: [
          { id: 'A', text: 'A footnote at the bottom of the page' },
          { id: 'B', text: 'A hint near an unknown word that helps you understand it' },
          { id: 'C', text: 'A definition copied from a dictionary' },
          { id: 'D', text: 'A bold title' },
        ],
        correctOptionId: 'B',
      },
      // ── Medium: inference & evidence ───────────────────────────────────────
      {
        id: 'reading-4',
        prompt: 'A character slammed the door and crossed their arms. What is the best inference?',
        options: [
          { id: 'A', text: 'They are probably upset' },
          { id: 'B', text: 'They are going to sleep' },
          { id: 'C', text: 'They forgot their homework' },
          { id: 'D', text: 'They are hungry' },
        ],
        correctOptionId: 'A',
      },
      {
        id: 'reading-5',
        prompt: 'Which piece of evidence best supports a claim about a story?',
        options: [
          { id: 'A', text: 'A direct quote from the text' },
          { id: 'B', text: 'A guess from memory' },
          { id: 'C', text: 'A classmate\'s opinion' },
          { id: 'D', text: 'A random internet fact' },
        ],
        correctOptionId: 'A',
      },
      {
        id: 'reading-6',
        prompt: 'A passage says, "The roads were slick and the wipers struggled to keep up." What can you infer about the weather?',
        options: [
          { id: 'A', text: 'It was sunny' },
          { id: 'B', text: 'It was raining heavily' },
          { id: 'C', text: 'It was windy but dry' },
          { id: 'D', text: 'It was snowing lightly' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'reading-7',
        prompt: 'In the sentence "She was reluctant to speak up in class," the word "reluctant" most likely means:',
        options: [
          { id: 'A', text: 'Eager' },
          { id: 'B', text: 'Hesitant' },
          { id: 'C', text: 'Loud' },
          { id: 'D', text: 'Confused' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'reading-8',
        prompt: 'When an author writes about a topic from one specific point of view, this is called:',
        options: [
          { id: 'A', text: 'Theme' },
          { id: 'B', text: 'Plot' },
          { id: 'C', text: 'Perspective' },
          { id: 'D', text: 'Setting' },
        ],
        correctOptionId: 'C',
      },
      // ── Harder: analysis, theme, author's purpose ──────────────────────────
      {
        id: 'reading-9',
        prompt: 'Which choice best describes the difference between theme and main idea?',
        options: [
          { id: 'A', text: 'They are the same thing' },
          { id: 'B', text: 'Theme is the broader message or lesson; main idea is what the text is mostly about' },
          { id: 'C', text: 'Theme is found only in poems; main idea only in articles' },
          { id: 'D', text: 'Main idea is always literal; theme is always a number' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'reading-10',
        prompt: 'Why might an author repeat a key word or phrase several times in a short text?',
        options: [
          { id: 'A', text: 'To fill space' },
          { id: 'B', text: 'To emphasize an important idea' },
          { id: 'C', text: 'To confuse the reader' },
          { id: 'D', text: 'Because they ran out of other words' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'reading-11',
        prompt: 'An article about climate change cites multiple scientists, dates, and statistics. The author\'s purpose is most likely to:',
        options: [
          { id: 'A', text: 'Entertain the reader' },
          { id: 'B', text: 'Persuade the reader using evidence' },
          { id: 'C', text: 'Tell a personal story' },
          { id: 'D', text: 'Describe a fictional event' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'reading-12',
        prompt: 'When two characters in a story consistently disagree about how to solve a problem, this creates:',
        options: [
          { id: 'A', text: 'Setting' },
          { id: 'B', text: 'Resolution' },
          { id: 'C', text: 'Conflict' },
          { id: 'D', text: 'Exposition' },
        ],
        correctOptionId: 'C',
      },
      {
        id: 'reading-13',
        prompt: 'A passage describes a small farming town as "a place where everyone knew the smell of rain before it arrived." This is an example of:',
        options: [
          { id: 'A', text: 'Statistics' },
          { id: 'B', text: 'A direct quotation' },
          { id: 'C', text: 'Figurative or sensory language' },
          { id: 'D', text: 'A counterargument' },
        ],
        correctOptionId: 'C',
      },
    ],
  },
  MATH: {
    key: 'math-v2',
    domain: 'MATH',
    title: 'Math Diagnostic',
    description: 'A 13-question check across number sense, fractions, equations, geometry, and reasoning. Takes about 10 minutes.',
    questions: [
      // ── Easy: arithmetic & number sense ────────────────────────────────────
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
        prompt: 'Which list is in order from least to greatest?',
        options: [
          { id: 'A', text: '0.5, 1/2, 0.45' },
          { id: 'B', text: '0.45, 1/2, 0.55' },
          { id: 'C', text: '0.55, 0.5, 0.45' },
          { id: 'D', text: '1/2, 0.45, 0.55' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'math-3',
        prompt: 'A student solved 18 + 27 by writing 20 + 25 instead. What strategy are they using?',
        options: [
          { id: 'A', text: 'Compensation' },
          { id: 'B', text: 'Graphing' },
          { id: 'C', text: 'Long division' },
          { id: 'D', text: 'Guess and check only' },
        ],
        correctOptionId: 'A',
      },
      // ── Medium: ratios, percents, areas ────────────────────────────────────
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
        prompt: 'A shirt costs $40 and is on sale for 25% off. What is the sale price?',
        options: [
          { id: 'A', text: '$15' },
          { id: 'B', text: '$25' },
          { id: 'C', text: '$30' },
          { id: 'D', text: '$35' },
        ],
        correctOptionId: 'C',
      },
      {
        id: 'math-6',
        prompt: 'If 4 pencils cost $1.20, how much do 10 pencils cost at the same rate?',
        options: [
          { id: 'A', text: '$2.40' },
          { id: 'B', text: '$3.00' },
          { id: 'C', text: '$3.60' },
          { id: 'D', text: '$4.00' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'math-7',
        prompt: 'Which fraction is equivalent to 6/8?',
        options: [
          { id: 'A', text: '2/4' },
          { id: 'B', text: '3/4' },
          { id: 'C', text: '4/6' },
          { id: 'D', text: '5/8' },
        ],
        correctOptionId: 'B',
      },
      // ── Harder: algebraic reasoning ────────────────────────────────────────
      {
        id: 'math-8',
        prompt: 'Which equation represents "five less than twice a number is 17"?',
        options: [
          { id: 'A', text: '2x + 5 = 17' },
          { id: 'B', text: '5 - 2x = 17' },
          { id: 'C', text: '2x - 5 = 17' },
          { id: 'D', text: '17 - 5 = 2x + 5' },
        ],
        correctOptionId: 'C',
      },
      {
        id: 'math-9',
        prompt: 'Solve for x: 3x + 4 = 19',
        options: [
          { id: 'A', text: 'x = 3' },
          { id: 'B', text: 'x = 5' },
          { id: 'C', text: 'x = 7' },
          { id: 'D', text: 'x = 15' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'math-10',
        prompt: 'In a coordinate plane, the point (3, -2) is located in which quadrant?',
        options: [
          { id: 'A', text: 'Quadrant I' },
          { id: 'B', text: 'Quadrant II' },
          { id: 'C', text: 'Quadrant III' },
          { id: 'D', text: 'Quadrant IV' },
        ],
        correctOptionId: 'D',
      },
      {
        id: 'math-11',
        prompt: 'The mean (average) of 4, 6, 8, and 10 is:',
        options: [
          { id: 'A', text: '6' },
          { id: 'B', text: '7' },
          { id: 'C', text: '8' },
          { id: 'D', text: '28' },
        ],
        correctOptionId: 'B',
      },
      {
        id: 'math-12',
        prompt: 'A right triangle has legs of 3 and 4. What is the length of the hypotenuse?',
        options: [
          { id: 'A', text: '5' },
          { id: 'B', text: '6' },
          { id: 'C', text: '7' },
          { id: 'D', text: '12' },
        ],
        correctOptionId: 'A',
      },
      {
        id: 'math-13',
        prompt: 'Why is showing your work useful in math?',
        options: [
          { id: 'A', text: 'It helps explain your reasoning and catch mistakes' },
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

// ─── Lesson-specific Diagnostic Helpers ──────────────────────────────────────

const FALLBACK_LESSON_QUESTIONS = [
  {
    id: 'diag-q1',
    question: 'Which statement best describes the main idea of a passage?',
    options: [
      'A) A minor detail from one sentence',
      'B) The central point the whole text supports',
      'C) A vocabulary term from the glossary',
      'D) The title only',
    ],
    correctAnswer: 'B',
    skill: 'main idea',
  },
  {
    id: 'diag-q2',
    question: 'A character sighs and stares out the window. What can you best infer?',
    options: [
      'A) The character is excited about a trip',
      'B) The character wants to eat lunch',
      'C) The character is feeling upset or distracted',
      'D) The character is looking for something lost',
    ],
    correctAnswer: 'C',
    skill: 'inference',
  },
  {
    id: 'diag-q3',
    question: 'What strategy best helps you figure out an unknown word without a dictionary?',
    options: [
      'A) Guess randomly and keep reading',
      'B) Use context clues from surrounding sentences',
      'C) Copy the sentence to ask a friend later',
      'D) Replace it with any simpler word',
    ],
    correctAnswer: 'B',
    skill: 'vocabulary',
  },
];

const DEFAULT_SKILLS = ['main idea', 'inference', 'vocabulary', 'comprehension', 'analysis'];

function buildDiagnosticFromLesson(lesson) {
  const quiz = lesson?.gradeLevel?.quiz;

  if (!quiz || !Array.isArray(quiz) || quiz.length === 0) {
    return {
      title: lesson?.title || 'Quick Learning Check',
      questions: FALLBACK_LESSON_QUESTIONS,
    };
  }

  const questions = quiz.slice(0, 3).map((q, i) => ({
    id: `diag-q${i + 1}`,
    question: q.question,
    options: Array.isArray(q.options) ? q.options : [],
    correctAnswer: q.correctAnswer || q.answer || 'A',
    skill: DEFAULT_SKILLS[i] || 'comprehension',
  }));

  // Pad to 3 if the quiz had fewer questions
  while (questions.length < 3) {
    const fallback = FALLBACK_LESSON_QUESTIONS[questions.length];
    questions.push({ ...fallback, id: `diag-q${questions.length + 1}` });
  }

  return {
    title: lesson.title || 'Quick Learning Check',
    questions,
  };
}

function getPublicQuestions(questions) {
  return questions.map(({ correctAnswer, ...rest }) => rest);
}

function scoreLessonDiagnostic(questions, answers) {
  const safeAnswers = (answers && typeof answers === 'object') ? answers : {};
  let score = 0;
  const skillsMissed = [];

  questions.forEach((q) => {
    const studentAnswer = String(safeAnswers[q.id] || '').toUpperCase().trim();
    const correct = studentAnswer === String(q.correctAnswer || '').toUpperCase().trim();
    if (correct) {
      score++;
    } else {
      skillsMissed.push(q.skill || 'comprehension');
    }
  });

  return { score, totalQuestions: questions.length, skillsMissed };
}

function determineReadingLevelFromScore(score, totalQuestions) {
  if (score <= 1) return 'FOUNDATIONAL';
  if (score < totalQuestions) return 'GRADE_LEVEL';
  return 'ADVANCED';
}

function buildAdaptationReason({ score, totalQuestions, newReadingLevel, skillsMissed }) {
  const levelLabels = {
    FOUNDATIONAL: 'Foundational',
    GRADE_LEVEL: 'Grade Level',
    ADVANCED: 'Advanced',
  };
  const levelLabel = levelLabels[newReadingLevel] || newReadingLevel;

  if (!skillsMissed || skillsMissed.length === 0) {
    return `Your lesson was adapted to ${levelLabel} based on your diagnostic score of ${score} out of ${totalQuestions}.`;
  }

  const uniqueSkills = [...new Set(skillsMissed)];
  const skillList = uniqueSkills.join(' and ');
  return `Your lesson was adapted to ${levelLabel} because the diagnostic showed support is needed with ${skillList}.`;
}

module.exports = {
  DIAGNOSTIC_DOMAINS,
  getDiagnosticCatalog,
  getQuestionSet,
  scoreDiagnostic,
  buildDiagnosticFromLesson,
  getPublicQuestions,
  scoreLessonDiagnostic,
  determineReadingLevelFromScore,
  buildAdaptationReason,
};
