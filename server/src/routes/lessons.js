const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { prisma } = require('../db');
const { requireAuth, requireTeacher } = require('../middleware/auth');

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.LESSONFORGE_MODEL || 'claude-opus-4-7';

function buildSystemPrompt() {
  return `You are an expert curriculum designer and special education specialist.
Your task is to generate differentiated lesson content at three distinct reading levels.

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
  return `Generate a complete differentiated lesson for the following curriculum standard:

STANDARD: "${standard}"
GRADE LEVEL: ${gradeLevel}
SUBJECT: ${subject}

Return a JSON object with EXACTLY this structure:
{
  "title": "string — lesson title",
  "subject": "string",
  "gradeLevel": "string",
  "standard": "string — the original standard",
  "estimatedMinutes": number,

  "foundational": {
    "levelLabel": "Foundational",
    "lexileRange": "400L-600L",
    "overview": "string — 2-3 sentences introducing the topic simply",
    "keyVocabulary": [
      { "term": "string", "definition": "string — child-friendly, one sentence" }
    ],
    "mainContent": "string — 4-6 paragraphs, short sentences, no abstract concepts",
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
  "gradeLevel": { /* identical structure */ },
  "advanced":   { /* identical structure */ }
}`;
}

// POST /api/lessons — Create lesson record, return ID for SSE streaming
router.post('/', requireTeacher, async (req, res) => {
  const { classId, standard } = req.body;

  if (!classId || !standard) {
    return res.status(400).json({ error: 'classId and standard are required' });
  }

  const cls = await prisma.class.findFirst({
    where: { id: classId, teacherId: req.user.id },
  });
  if (!cls) return res.status(403).json({ error: 'Class not found or access denied' });

  const lesson = await prisma.lesson.create({
    data: {
      classId,
      standard,
      title: `Lesson: ${standard.substring(0, 60)}`,
      status: 'GENERATING',
    },
  });

  res.status(202).json({ lessonId: lesson.id });
});

// GET /api/lessons/:id/stream — SSE endpoint streaming Claude output and saving on complete
router.get('/:id/stream', requireTeacher, async (req, res) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);

  let fullContent = '';

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(
            lesson.standard,
            req.query.gradeLevel || '6',
            req.query.subject || 'ELA'
          ),
        },
      ],
    });

    stream.on('text', (text) => {
      fullContent += text;
      sendEvent('chunk', { text });
    });

    stream.on('finalMessage', async () => {
      try {
        const cleaned = fullContent.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        const required = ['title', 'foundational', 'gradeLevel', 'advanced'];
        const missing = required.filter((k) => !parsed[k]);
        if (missing.length > 0) throw new Error(`Missing keys: ${missing.join(', ')}`);

        await prisma.lesson.update({
          where: { id: lesson.id },
          data: {
            title: parsed.title,
            status: 'READY',
            foundational: parsed.foundational,
            gradeLevel: parsed.gradeLevel,
            advanced: parsed.advanced,
          },
        });

        clearInterval(keepAlive);
        sendEvent('complete', { lessonId: lesson.id, title: parsed.title });
        res.end();
      } catch (parseErr) {
        clearInterval(keepAlive);
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: { status: 'FAILED' },
        });
        sendEvent('error', { message: `Parse failed: ${parseErr.message}` });
        res.end();
      }
    });

    stream.on('error', async (err) => {
      clearInterval(keepAlive);
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { status: 'FAILED' },
      });
      sendEvent('error', { message: err.message });
      res.end();
    });
  } catch (err) {
    clearInterval(keepAlive);
    sendEvent('error', { message: err.message });
    res.end();
  }

  req.on('close', () => clearInterval(keepAlive));
});

// GET /api/lessons/:id — Fetch a completed lesson
router.get('/:id', requireAuth, async (req, res) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: 'Not found' });
  res.json(lesson);
});

// GET /api/lessons/class/:classId — All lessons in a class
router.get('/class/:classId', requireAuth, async (req, res) => {
  const lessons = await prisma.lesson.findMany({
    where: { classId: req.params.classId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(lessons);
});

module.exports = router;
