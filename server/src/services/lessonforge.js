const Anthropic = require('@anthropic-ai/sdk');
const { normalizeLessonPayload } = require('../lib/lesson-schema');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.LESSONFORGE_MODEL || 'claude-sonnet-4-5-20250929';
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

  return `Generate a complete differentiated lesson for:

STANDARD: "${standard}"
GRADE LEVEL: ${gradeLevel}
SUBJECT: ${subject}

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

function generateLessonStream(standard, gradeLevel, subject, onChunk, onComplete, onError) {
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
