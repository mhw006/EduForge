/**
 * Phase 1 — Teacher Feedback Loop
 *
 * Captures section-level edit decisions teachers make on AI-generated lessons.
 * Each row in `LessonEdit` is one accept/modify/reject/regenerate event.
 *
 * Endpoints:
 *   POST /api/edits/:lessonId          — log a single section edit
 *   GET  /api/edits/lesson/:lessonId   — full edit history for one lesson
 *   GET  /api/edits/summary?classId=…  — aggregated AI-vs-human metrics
 */
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { assertLessonAccess } = require('../lib/lesson-access');
const { isHttpError } = require('../lib/http-error');
const demoStore = require('../services/demo-store');

const router = express.Router();

const VALID_LEVELS = ['FOUNDATIONAL', 'GRADE_LEVEL', 'ADVANCED'];
const VALID_SECTIONS = ['TITLE', 'OVERVIEW', 'MAIN_CONTENT', 'KEY_VOCABULARY', 'ACTIVITIES', 'QUIZ'];
const VALID_EDIT_TYPES = ['ACCEPTED_AS_IS', 'MODIFIED', 'REJECTED', 'REGENERATED'];

function jsonByteLen(obj) {
  if (obj === null || obj === undefined) return 0;
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

// POST /api/edits/:lessonId — record one section decision
router.post('/:lessonId', requireTeacher, async (req, res) => {
  const teacherId = req.auth?.userId || req.user?.id;
  const { level, section, editType, aiVersion, humanVersion = null } = req.body;

  if (!VALID_LEVELS.includes(level))         return res.status(400).json({ error: `level must be one of ${VALID_LEVELS.join('|')}` });
  if (!VALID_SECTIONS.includes(section))     return res.status(400).json({ error: `section must be one of ${VALID_SECTIONS.join('|')}` });
  if (!VALID_EDIT_TYPES.includes(editType))  return res.status(400).json({ error: `editType must be one of ${VALID_EDIT_TYPES.join('|')}` });
  if (aiVersion === undefined)               return res.status(400).json({ error: 'aiVersion is required (snapshot of original Claude output)' });

  if (demoStore.isDemoStoreEnabled()) {
    const charDelta = Math.abs(jsonByteLen(humanVersion) - jsonByteLen(aiVersion));
    const edit = demoStore.recordEdit({
      lessonId: req.params.lessonId,
      teacherId,
      level,
      section,
      editType,
      aiVersion,
      humanVersion,
      charDelta,
    });
    if (!edit) return res.status(404).json({ error: 'Lesson not found or not yours' });
    return res.status(201).json({
      id: edit.id,
      editType: edit.editType,
      charDelta: edit.charDelta,
      createdAt: edit.createdAt,
    });
  }

  try {
    await assertLessonAccess({
      lessonId: req.params.lessonId,
      userId: teacherId,
      allowTeacherOwner: true,
      allowEnrolledStudent: false,
    });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }

  const charDelta = Math.abs(jsonByteLen(humanVersion) - jsonByteLen(aiVersion));

  const edit = await prisma.lessonEdit.create({
    data: {
      lessonId: req.params.lessonId,
      teacherId,
      level,
      section,
      editType,
      aiVersion,
      humanVersion,
      charDelta,
    },
    select: { id: true, editType: true, charDelta: true, createdAt: true },
  });

  res.status(201).json(edit);
});

// GET /api/edits/lesson/:lessonId — full per-lesson history (teacher only)
router.get('/lesson/:lessonId', requireTeacher, async (req, res) => {
  try {
    await assertLessonAccess({
      lessonId: req.params.lessonId,
      userId: req.auth?.userId || req.user?.id,
      allowTeacherOwner: true,
      allowEnrolledStudent: false,
    });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }

  const edits = await prisma.lessonEdit.findMany({
    where: { lessonId: req.params.lessonId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, level: true, section: true, editType: true, charDelta: true, createdAt: true },
  });

  res.json({ edits });
});

// GET /api/edits/summary?classId=… — aggregated AI-vs-human metrics
// Requires either ?classId or ?lessonId. Restricted to lessons the teacher owns.
router.get('/summary', requireTeacher, async (req, res) => {
  const teacherId = req.auth?.userId || req.user?.id;
  const { classId, lessonId } = req.query;

  if (!classId && !lessonId) {
    return res.status(400).json({ error: 'classId or lessonId required' });
  }

  let lessonIds;
  if (lessonId) {
    try {
      await assertLessonAccess({ lessonId, userId: teacherId, allowTeacherOwner: true });
    } catch (err) {
      if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
      return res.status(500).json({ error: err.message });
    }
    lessonIds = [lessonId];
  } else {
    const cls = await prisma.class.findFirst({ where: { id: classId, teacherId } });
    if (!cls) return res.status(403).json({ error: 'Class not found or not yours' });
    const lessons = await prisma.lesson.findMany({ where: { classId }, select: { id: true } });
    lessonIds = lessons.map((l) => l.id);
  }

  if (lessonIds.length === 0) {
    return res.json({
      totalEdits: 0,
      acceptanceRate: 0,
      bySection: [],
      byEditType: [],
      avgCharDelta: 0,
    });
  }

  const [allEdits, byType, bySectionType] = await Promise.all([
    prisma.lessonEdit.findMany({
      where: { lessonId: { in: lessonIds } },
      select: { charDelta: true },
    }),
    prisma.lessonEdit.groupBy({
      by: ['editType'],
      where: { lessonId: { in: lessonIds } },
      _count: { id: true },
    }),
    prisma.lessonEdit.groupBy({
      by: ['section', 'editType'],
      where: { lessonId: { in: lessonIds } },
      _count: { id: true },
    }),
  ]);

  const totalEdits = allEdits.length;
  const accepted = byType.find((b) => b.editType === 'ACCEPTED_AS_IS')?._count.id || 0;
  const acceptanceRate = totalEdits ? Number((accepted / totalEdits).toFixed(3)) : 0;
  const avgCharDelta = totalEdits
    ? Math.round(allEdits.reduce((sum, e) => sum + e.charDelta, 0) / totalEdits)
    : 0;

  // Reshape bySectionType into {section, accepted, modified, rejected, regenerated}
  const bySection = VALID_SECTIONS.map((sec) => {
    const row = { section: sec };
    for (const t of VALID_EDIT_TYPES) {
      const found = bySectionType.find((b) => b.section === sec && b.editType === t);
      row[t.toLowerCase()] = found?._count.id || 0;
    }
    row.total = VALID_EDIT_TYPES.reduce((s, t) => s + (row[t.toLowerCase()] || 0), 0);
    return row;
  }).filter((r) => r.total > 0);

  res.json({
    totalEdits,
    acceptanceRate,
    avgCharDelta,
    byEditType: byType.map((b) => ({ editType: b.editType, count: b._count.id })),
    bySection,
  });
});

module.exports = router;
