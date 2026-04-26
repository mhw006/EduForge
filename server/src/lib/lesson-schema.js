const { HttpError } = require('./http-error');

const LEVEL_KEYS = ['foundational', 'gradeLevel', 'advanced'];

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeQuizQuestion(question, path) {
  if (!question || typeof question !== 'object') {
    throw new HttpError(500, `${path} must be an object`);
  }

  const normalized = {
    question: asNonEmptyString(question.question),
    options: Array.isArray(question.options) ? question.options.map((option) => String(option)) : [],
    correctAnswer: asNonEmptyString(question.correctAnswer || question.answer),
    explanation: asNonEmptyString(question.explanation) || '',
  };

  if (!normalized.question) throw new HttpError(500, `${path}.question is required`);
  if (normalized.options.length !== 4) throw new HttpError(500, `${path}.options must contain exactly 4 items`);
  if (!normalized.correctAnswer) throw new HttpError(500, `${path}.correctAnswer is required`);

  return normalized;
}

function normalizeActivity(activity, path) {
  if (!activity || typeof activity !== 'object') {
    throw new HttpError(500, `${path} must be an object`);
  }

  const normalized = {
    title: asNonEmptyString(activity.title),
    instructions: asNonEmptyString(activity.instructions),
    estimatedMinutes: Number.isFinite(Number(activity.estimatedMinutes))
      ? Number(activity.estimatedMinutes)
      : null,
  };

  if (!normalized.title) throw new HttpError(500, `${path}.title is required`);
  if (!normalized.instructions) throw new HttpError(500, `${path}.instructions is required`);

  return normalized;
}

function normalizeVocabulary(entry, path) {
  if (!entry || typeof entry !== 'object') {
    throw new HttpError(500, `${path} must be an object`);
  }

  const normalized = {
    term: asNonEmptyString(entry.term),
    definition: asNonEmptyString(entry.definition),
  };

  if (!normalized.term) throw new HttpError(500, `${path}.term is required`);
  if (!normalized.definition) throw new HttpError(500, `${path}.definition is required`);

  return normalized;
}

function normalizeLessonLevel(level, levelKey) {
  if (!level || typeof level !== 'object') {
    throw new HttpError(500, `${levelKey} level is required`);
  }

  const normalized = {
    levelLabel: asNonEmptyString(level.levelLabel) || levelKey,
    lexileRange: asNonEmptyString(level.lexileRange) || null,
    overview: asNonEmptyString(level.overview) || asNonEmptyString(level.summary) || '',
    keyVocabulary: Array.isArray(level.keyVocabulary)
      ? level.keyVocabulary.map((entry, index) => normalizeVocabulary(entry, `${levelKey}.keyVocabulary[${index}]`))
      : [],
    mainContent:
      asNonEmptyString(level.mainContent) ||
      asNonEmptyString(level.reading_passage) ||
      asNonEmptyString(level.readingPassage) ||
      '',
    activities: Array.isArray(level.activities)
      ? level.activities.map((activity, index) => normalizeActivity(activity, `${levelKey}.activities[${index}]`))
      : [],
    quiz: Array.isArray(level.quiz)
      ? level.quiz.map((question, index) => normalizeQuizQuestion(question, `${levelKey}.quiz[${index}]`))
      : [],
    discussionPrompts: Array.isArray(level.discussionPrompts)
      ? level.discussionPrompts.map((prompt) => String(prompt))
      : Array.isArray(level.discussion_prompts)
        ? level.discussion_prompts.map((prompt) => String(prompt))
        : [],
    extensionActivities: Array.isArray(level.extensionActivities)
      ? level.extensionActivities.map((activity) => String(activity))
      : Array.isArray(level.extension_activities)
        ? level.extension_activities.map((activity) => String(activity))
        : [],
  };

  if (!normalized.overview) throw new HttpError(500, `${levelKey}.overview is required`);
  if (!normalized.mainContent) throw new HttpError(500, `${levelKey}.mainContent is required`);
  if (normalized.quiz.length !== 5) throw new HttpError(500, `${levelKey}.quiz must contain exactly 5 questions`);

  return normalized;
}

function normalizeLessonPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new HttpError(500, 'Lesson payload must be an object');
  }

  const normalized = {
    title: asNonEmptyString(payload.title),
    subject: asNonEmptyString(payload.subject) || null,
    targetGrade: asNonEmptyString(payload.targetGrade) || null,
    standard: asNonEmptyString(payload.standard) || null,
    estimatedMinutes: Number.isFinite(Number(payload.estimatedMinutes))
      ? Number(payload.estimatedMinutes)
      : null,
  };

  if (!normalized.title) {
    throw new HttpError(500, 'Lesson title is required');
  }

  for (const levelKey of LEVEL_KEYS) {
    normalized[levelKey] = normalizeLessonLevel(payload[levelKey], levelKey);
  }

  return normalized;
}

module.exports = {
  LEVEL_KEYS,
  normalizeLessonPayload,
};
