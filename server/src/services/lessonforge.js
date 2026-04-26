const Anthropic = require('@anthropic-ai/sdk');
const { normalizeLessonPayload } = require('../lib/lesson-schema');
const { buildContextBlock } = require('./standards-retrieval');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.LESSONFORGE_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = Number(process.env.LESSONFORGE_MAX_TOKENS || 5200);
const DETAIL_LEVEL = process.env.LESSONFORGE_DETAIL_LEVEL || 'demo';

function getDetailInstructions() {
  if (DETAIL_LEVEL === 'full') {
    return {
      overview: '2-3 sentences',
      mainContent: '4 paragraphs, each 3-4 sentences',
      vocabulary: '4',
      activities: '2',
    };
  }

  return {
    overview: '1-2 concise sentences',
    mainContent: '2 paragraphs, each 3-4 sentences',
    vocabulary: '3',
    activities: '1',
  };
}

function buildSystemPrompt() {
  return `You are an expert curriculum designer and special education specialist.
Generate differentiated lesson content at three distinct reading levels.

CRITICAL OUTPUT RULES:
1. Respond ONLY with a valid JSON object. No markdown, no prose, no code fences.
2. Never truncate. Complete all three levels fully before ending your response.
3. Each level must be pedagogically appropriate, not just shorter or longer.
4. The foundational level must use Lexile 400L-600L language.
5. The gradeLevel level must use Lexile 700L-900L language.
6. The advanced level must use Lexile 1000L-1200L language.
7. keyVocabulary must be specific words from your generated content, not generic.
8. Each quiz must have exactly 5 questions with 4 multiple-choice options each.
9. Be concise. Do not add extra fields or long explanations outside the requested strings.`;
}

function buildUserPrompt(standard, gradeLevel, subject) {
  const detail = getDetailInstructions();
  const contextBlock = buildContextBlock(standard);

  return `Generate a complete differentiated lesson for:

STANDARD: "${standard}"
GRADE LEVEL: ${gradeLevel}
SUBJECT: ${subject}
${contextBlock ? `\n${contextBlock}\n` : ''}

Length targets for fast classroom/demo use:
- overview: ${detail.overview}
- keyVocabulary: exactly ${detail.vocabulary} entries per level
- mainContent: ${detail.mainContent} per level
- activities: exactly ${detail.activities} per level
- quiz: exactly 5 questions per level

Return a JSON object with EXACTLY this structure:
{
  "title": "string",
  "subject": "string",
  "targetGrade": "string",
  "standard": "string",
  "estimatedMinutes": number,
  "foundational": {
    "levelLabel": "Foundational",
    "lexileRange": "400L-600L",
    "overview": "string",
    "keyVocabulary": [
      { "term": "string", "definition": "string" }
    ],
    "mainContent": "string",
    "activities": [
      { "title": "string", "instructions": "string", "estimatedMinutes": number }
    ],
    "quiz": [
      {
        "question": "string",
        "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
        "correctAnswer": "A",
        "explanation": "string"
      }
    ]
  },
  "gradeLevel": {
    "levelLabel": "Grade Level",
    "lexileRange": "700L-900L",
    "overview": "string",
    "keyVocabulary": [
      { "term": "string", "definition": "string" }
    ],
    "mainContent": "string",
    "activities": [
      { "title": "string", "instructions": "string", "estimatedMinutes": number }
    ],
    "quiz": [
      {
        "question": "string",
        "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
        "correctAnswer": "A",
        "explanation": "string"
      }
    ]
  },
  "advanced": {
    "levelLabel": "Advanced",
    "lexileRange": "1000L-1200L",
    "overview": "string",
    "keyVocabulary": [
      { "term": "string", "definition": "string" }
    ],
    "mainContent": "string",
    "activities": [
      { "title": "string", "instructions": "string", "estimatedMinutes": number }
    ],
    "quiz": [
      {
        "question": "string",
        "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
        "correctAnswer": "A",
        "explanation": "string"
      }
    ]
  }
}`;
}

function parseLessonContent(rawContent) {
  const cleaned = rawContent.replace(/```json\n?|\n?```/g, '').trim();
  return normalizeLessonPayload(JSON.parse(cleaned));
}

function makeQuiz(label) {
  return Array.from({ length: 5 }, (_, index) => ({
    question: `${label} check ${index + 1}: Which response best shows understanding?`,
    options: [
      'A) Use evidence from the lesson',
      'B) Guess without reading',
      'C) Ignore the main idea',
      'D) Change the topic',
    ],
    correctAnswer: 'A',
    explanation: 'Using evidence from the lesson shows understanding.',
  }));
}

function buildDemoLesson(standard, gradeLevel, subject) {
  const topic = String(standard || 'the lesson goal').trim();
  return normalizeLessonPayload({
    title: `${subject} Lesson: ${topic.slice(0, 72)}`,
    subject,
    targetGrade: String(gradeLevel),
    standard: topic,
    estimatedMinutes: 35,
    foundational: {
      levelLabel: 'Foundational',
      lexileRange: '400L-600L',
      overview: `Today you will learn about ${topic}. We will break the idea into small steps and use examples.`,
      keyVocabulary: [
        { term: 'main idea', definition: 'The most important point in a lesson or text.' },
        { term: 'evidence', definition: 'Details that help prove or explain an answer.' },
        { term: 'example', definition: 'A case that shows what an idea means.' },
      ],
      mainContent: `Start with the main idea: ${topic}. Read one sentence at a time. After each part, ask, "What does this mean?" Then find one detail that helps explain it.\n\nA strong learner can point to evidence. Evidence is a word, number, example, or detail from the lesson. When you use evidence, your answer becomes clearer and stronger.`,
      activities: [
        { title: 'Circle and Say', instructions: 'Circle three important words, then explain each one to a partner in your own words.', estimatedMinutes: 8 },
      ],
      quiz: makeQuiz('Foundational'),
    },
    gradeLevel: {
      levelLabel: 'Grade Level',
      lexileRange: '700L-900L',
      overview: `Students explore ${topic}, identify the core concept, and support explanations with evidence.`,
      keyVocabulary: [
        { term: 'concept', definition: 'A key idea that helps organize learning.' },
        { term: 'supporting detail', definition: 'A fact or example that explains the main idea.' },
        { term: 'reasoning', definition: 'The thinking that connects evidence to an answer.' },
      ],
      mainContent: `${topic} is the focus of this lesson. To understand it well, identify the central concept, then connect it to examples and evidence. This helps you move from remembering information to explaining why it matters.\n\nWhen you answer a question, include both evidence and reasoning. Evidence shows where your idea came from. Reasoning explains how that evidence supports your answer.`,
      activities: [
        { title: 'Evidence Builder', instructions: 'Write one claim about the topic, add two pieces of evidence, and explain how each one supports your claim.', estimatedMinutes: 12 },
      ],
      quiz: makeQuiz('Grade-level'),
    },
    advanced: {
      levelLabel: 'Advanced',
      lexileRange: '1000L-1200L',
      overview: `Students analyze ${topic}, evaluate relationships among ideas, and transfer the concept to a new context.`,
      keyVocabulary: [
        { term: 'analysis', definition: 'A careful study of parts and how they work together.' },
        { term: 'synthesis', definition: 'Combining ideas to form a stronger understanding.' },
        { term: 'transfer', definition: 'Applying learning in a new situation.' },
      ],
      mainContent: `A deeper understanding of ${topic} requires analysis and transfer. Analysis asks you to examine the parts of an idea, while transfer asks you to apply that idea beyond the first example. Together, these habits help you build flexible knowledge.\n\nAs you work, compare examples, evaluate which evidence is strongest, and explain the limits of your answer. Strong academic thinking includes both confidence and precision.`,
      activities: [
        { title: 'Transfer Challenge', instructions: 'Apply the lesson concept to a new situation, then explain what changed and what stayed the same.', estimatedMinutes: 15 },
      ],
      quiz: makeQuiz('Advanced'),
    },
  });
}

function generateLessonStream(standard, gradeLevel, subject, onChunk, onComplete, onError) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.endsWith('...')) {
    const lesson = buildDemoLesson(standard, gradeLevel, subject);
    onChunk(JSON.stringify(lesson));
    onComplete(lesson);
    return;
  }

  let fullContent = '';

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(standard, gradeLevel, subject) }],
    });

    stream.on('text', (text) => {
      fullContent += text;
      onChunk(text);
    });

    stream.on('finalMessage', () => {
      try {
        onComplete(parseLessonContent(fullContent));
      } catch (parseErr) {
        onError(parseErr);
      }
    });

    stream.on('error', onError);
  } catch (err) {
    onError(err);
  }
}

async function generateLesson(standard, gradeLevel, subject) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.endsWith('...')) {
    return buildDemoLesson(standard, gradeLevel, subject);
  }

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.3,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(standard, gradeLevel, subject) }],
  });

  return parseLessonContent(message.content[0].text);
}

module.exports = { generateLessonStream, generateLesson };
