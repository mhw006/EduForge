const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5-20251001';

function buildSystemPrompt() {
  return `You are an expert curriculum designer and special education specialist.
Generate differentiated lesson content at three distinct reading levels.

CRITICAL OUTPUT RULES:
1. Respond ONLY with a valid JSON object. No markdown, no prose, no code fences.
2. Never truncate. Complete all three levels fully before ending your response.
3. Each level must be pedagogically appropriate — not just shorter/longer.
4. The 'foundational' level must use Lexile 400L–600L language (concrete nouns, short sentences, no jargon).
5. The 'gradeLevel' level must use Lexile 700L–900L language (grade-appropriate vocabulary, some abstract concepts).
6. The 'advanced' level must use Lexile 1000L–1200L language (Socratic questions, synthesis tasks, domain vocabulary).
7. keyVocabulary must be specific words from YOUR generated content, not generic.
8. Each quiz must have exactly 5 questions with 4 multiple-choice options each.`;
}

function buildUserPrompt(standard, gradeLevel, subject) {
  return `Generate a complete differentiated lesson for:

STANDARD: "${standard}"
GRADE LEVEL: ${gradeLevel}
SUBJECT: ${subject}

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
    "overview": "string — 2-3 sentences introducing the topic",
    "keyVocabulary": [
      { "term": "string", "definition": "string — child-friendly, one sentence" }
    ],
    "mainContent": "string — 4-6 paragraphs of lesson content",
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
    "overview": "string — 2-3 sentences introducing the topic",
    "keyVocabulary": [
      { "term": "string", "definition": "string — one sentence" }
    ],
    "mainContent": "string — 4-6 paragraphs of lesson content",
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
    "overview": "string — 2-3 sentences introducing the topic",
    "keyVocabulary": [
      { "term": "string", "definition": "string — precise academic definition" }
    ],
    "mainContent": "string — 4-6 paragraphs of lesson content",
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

function generateLessonStream(standard, gradeLevel, subject, onChunk, onComplete, onError) {
  let fullContent = '';

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(standard, gradeLevel, subject) }],
    });

    stream.on('text', (text) => {
      fullContent += text;
      onChunk(text);
    });

    stream.on('finalMessage', () => {
      try {
        const cleaned = fullContent.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        const required = ['title', 'foundational', 'gradeLevel', 'advanced'];
        const missing = required.filter((k) => !parsed[k]);
        if (missing.length > 0) {
          throw new Error(`Missing required keys: ${missing.join(', ')}`);
        }

        onComplete(parsed);
      } catch (parseErr) {
        onError(parseErr);
      }
    });

    stream.on('error', onError);
  } catch (err) {
    onError(err);
  }
}

// ─── Non-streaming promise-based version ─────────────────────────────────────
async function generateLesson(standard, gradeLevel, subject) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(standard, gradeLevel, subject) }],
  });

  const rawContent = message.content[0].text;
  const cleaned = rawContent.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const required = ['title', 'foundational', 'gradeLevel', 'advanced'];
  const missing = required.filter((k) => !parsed[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required keys: ${missing.join(', ')}`);
  }

  return parsed;
}

module.exports = { generateLessonStream, generateLesson };
