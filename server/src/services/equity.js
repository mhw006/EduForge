const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Adapts lesson content for a specific learner profile using Claude.
 * Handles language translation, reading level targeting, and accessibility.
 *
 * @param {string} topic - The lesson topic or raw content to adapt
 * @param {object} profile - Learner profile settings
 * @param {string} profile.readingLevel - e.g. 'Grade 1-3', 'Grade 6-8', 'Lexile 900+'
 * @param {string} profile.language - e.g. 'English', 'Spanish', 'Mandarin'
 * @param {boolean} profile.dyslexiaFont - Enable dyslexia-friendly formatting
 * @param {boolean} profile.highContrast - High contrast mode flag
 * @param {boolean} profile.screenReader - Screen reader friendly mode
 * @param {string} profile.bandwidth - 'full-media' | 'reduced-media' | 'text-only'
 */
async function adaptContentForLearner(topic, profile = {}) {
  const {
    readingLevel = 'Grade 6-8',
    language = 'English',
    dyslexiaFont = false,
    highContrast = false,
    screenReader = false,
    bandwidth = 'full-media',
  } = profile;

  const lexileMap = {
    'Grade 1-3':  '200L–400L — very short sentences, everyday words, simple ideas',
    'Grade 4-5':  '500L–700L — clear sentences, concrete vocabulary, step-by-step explanation',
    'Grade 6-8':  '700L–900L — paragraph form, grade-appropriate vocabulary, some abstract concepts',
    'Grade 9-12': '900L–1100L — analytical language, domain vocabulary, nuanced argument',
    'Lexile 900+': '1100L+ — sophisticated prose, technical terms, Socratic framing',
  };

  const languageInstruction = language !== 'English'
    ? `CRITICAL: Write ALL student-facing text (mainContent, keyTerms definitions, studyModes descriptions, adaptedTitle) in ${language}. JSON keys must remain in English.`
    : 'Write all content in English.';

  const dyslexiaInstruction = dyslexiaFont
    ? 'DYSLEXIA SUPPORT: Use very short sentences (max 12 words each). Use bullet points instead of paragraphs. Add blank line between every list item. Avoid italics or ALL CAPS.'
    : '';

  const screenReaderInstruction = screenReader
    ? 'SCREEN READER: For any visual element mentioned, add a full verbal description. Use numbered lists instead of visual metaphors.'
    : '';

  const bandwidthInstruction = bandwidth === 'text-only'
    ? 'TEXT-ONLY MODE: Remove ALL references to images, videos, or media. Keep only text content. Activities must be pencil-and-paper or verbal only.'
    : bandwidth === 'reduced-media'
    ? 'REDUCED MEDIA: Minimize media references. One optional image per section maximum. No video content.'
    : '';

  const systemPrompt = `You are an expert educational accessibility and equity specialist.
Your role is to adapt lesson content so every student — regardless of language, reading level, or disability — can access and understand it.

ABSOLUTE RULES:
1. Respond ONLY with a valid JSON object. No markdown fences, no extra prose.
2. Never truncate. Complete the full JSON before ending.
3. ${languageInstruction}
4. Match reading level: ${lexileMap[readingLevel] || lexileMap['Grade 6-8']}
${dyslexiaInstruction}
${screenReaderInstruction}
${bandwidthInstruction}`;

  const userPrompt = `Adapt this content for a student:

TOPIC: "${topic}"
READING LEVEL: ${readingLevel}
PRIMARY LANGUAGE: ${language}
DYSLEXIA SUPPORT: ${dyslexiaFont}
HIGH CONTRAST: ${highContrast}
SCREEN READER: ${screenReader}
BANDWIDTH: ${bandwidth}

Return a JSON object with EXACTLY this structure:
{
  "adaptedTitle": "string — title in the student's language",
  "mainContent": "string — full adapted lesson in the student's language at their reading level (4-6 paragraphs or equivalent bullet blocks for dyslexia mode)",
  "keyTerms": [
    { "term": "string", "definition": "string — in the student's language, one sentence" }
  ],
  "studyModes": [
    {
      "mode": "visual",
      "label": "string — mode label in student's language",
      "description": "string — visual learning activity or description in student's language",
      "accessibilityNote": "string — brief English note about accessibility considerations"
    },
    {
      "mode": "audio",
      "label": "string",
      "description": "string — listening/speaking activity in student's language",
      "accessibilityNote": "string"
    },
    {
      "mode": "reading",
      "label": "string",
      "description": "string — reading activity or text passage in student's language",
      "accessibilityNote": "string"
    },
    {
      "mode": "interactive",
      "label": "string",
      "description": "string — hands-on or collaborative activity in student's language",
      "accessibilityNote": "string"
    }
  ],
  "accessibilityMeta": {
    "appliedReadingLevel": "${readingLevel}",
    "language": "${language}",
    "dyslexiaFont": ${dyslexiaFont},
    "highContrast": ${highContrast},
    "screenReader": ${screenReader},
    "bandwidthMode": "${bandwidth}"
  }
}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawContent = message.content[0].text;
  const cleaned = rawContent.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { adaptContentForLearner };
