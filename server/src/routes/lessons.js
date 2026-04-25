const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../lib/prisma');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { adaptContent } = require('../middleware/adapt');
const router = express.Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.LESSONFORGE_MODEL || 'claude-sonnet-4-20250514';

function buildSystemPrompt() {
  return `You are an expert curriculum designer and special education specialist.
Your task is to generate differentiated lesson content at three distinct reading levels.

CRITICAL OUTPUT RULES:
1. Respond ONLY with a valid JSON object. No markdown, no prose, no code fences.
2. Never truncate. Complete all three levels fully before ending your response.
3. Each level must be pedagogically appropriate — not just shorter/longer.
4. The 'foundational' level must use Lexile 400L-600L language.
5. The 'gradeLevel' level must use Lexile 700L-900L language.
6. The 'advanced' level must use Lexile 1000L-1200L language.
7. Each quiz must have exactly 5 questions with 4 multiple-choice options each.`;
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
  "gradeLevel": "string",
  "standard": "string",
  "estimatedMinutes": number,
  "foundational": {
    "levelLabel": "Foundational",
    "lexileRange": "400L-600L",
    "overview": "string",
    "keyVocabulary": [{ "term": "string", "definition": "string" }],
    "mainContent": "string",
    "activities": [{ "title": "string", "instructions": "string", "estimatedMinutes": number }],
    "quiz": [{ "question": "string", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correctAnswer": "A", "explanation": "string" }]
  },
  "gradeLevel": { },
  "advanced": { }
}`;
}

// ─── POST /api/lessons — Create lesson record, return ID ─────────────────────
router.post('/', requireTeacher, async (req, res) => {
  const { classId, standard } = req.body;

  if (!classId || !standard) {
    return res.status(400).json({ error: 'classId and standard are required' });
  }

  if (standard.length > 2000) {
    return res.status(400).json({ error: 'Standard text must be under 2000 characters' });
  }

  const cls = await prisma.class.findFirst({
    where: { id: classId, teacherId: req.auth?.userId || req.user?.id },
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

// ─── GET /api/lessons/:id/stream — SSE streaming ─────────────────────────────
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
  req.on('close', () => clearInterval(keepAlive));

  let fullContent = '';

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      system: buildSystemPrompt(),
      messages: [{
        role: 'user',
        content: buildUserPrompt(
          lesson.standard,
          req.query.gradeLevel || '6',
          req.query.subject || 'ELA'
        ),
      }],
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
        }).catch(() => {});
        sendEvent('error', { message: `Parse failed: ${parseErr.message}` });
        res.end();
      }
    });

    stream.on('error', async (err) => {
      clearInterval(keepAlive);
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { status: 'FAILED' },
      }).catch(() => {});
      sendEvent('error', { message: err.message });
      res.end();
    });
  } catch (err) {
    clearInterval(keepAlive);
    sendEvent('error', { message: err.message });
    res.end();
  }
});

// ─── GET /api/lessons/class/:classId ─────────────────────────────────────────
router.get('/class/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.auth?.userId || req.user?.id;

    const classRecord = await prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord) return res.status(404).json({ error: 'Class not found' });

    const isTeacher = classRecord.teacherId === userId;
    if (!isTeacher) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_classId: { userId, classId } },
      });
      if (!enrollment) return res.status(403).json({ error: 'Not enrolled in this class' });
    }

    const lessons = await prisma.lesson.findMany({
      where: { classId, status: 'READY' },
      select: { id: true, title: true, standard: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ lessons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/lessons/:id ─────────────────────────────────────────────────────
router.get('/:id', requireAuth, adaptContent, async (req, res) => {
  try {
    if (req.adaptedContent) return res.json(req.adaptedContent);

    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: { class: { select: { teacherId: true } } },
    });

    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    const userId = req.auth?.userId || req.user?.id;
    if (lesson.class.teacherId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      id: lesson.id,
      title: lesson.title,
      standard: lesson.standard,
      status: lesson.status,
      foundational: lesson.foundational,
      gradeLevel: lesson.gradeLevel,
      advanced: lesson.advanced,
      createdAt: lesson.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;