const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { prisma } = require('../db');
const { requireAuth, requireTeacher } = require('../middleware/auth');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.LESSONFORGE_MODEL || 'claude-sonnet-4-5-20250929';

// ─── Phase 3: Student engagement event capture ───────────────────────────────
// Lightweight fire-and-forget endpoint students hit on toggle interactions.
// Failures here MUST NEVER break student UX — server returns 204 even on bad
// payloads (we just drop them).
const VALID_EVENT_TYPES = [
  'VIEW', 'QUIZ_START', 'QUIZ_COMPLETE',
  'LANGUAGE_TOGGLE', 'TTS_TOGGLE', 'BANDWIDTH_CHANGE', 'EXPORT_PDF',
];

router.post('/event', requireAuth, async (req, res) => {
  const { lessonId, eventType, metadata = {} } = req.body || {};
  const userId = req.auth?.userId || req.user?.id;

  if (!lessonId || !VALID_EVENT_TYPES.includes(eventType)) {
    return res.status(204).end(); // silently drop invalid events
  }

  try {
    await prisma.engagementEvent.create({
      data: { userId, lessonId, eventType, metadata },
    });
  } catch {
    // FK violation (lessonId doesn't exist) or other transient — silently drop.
  }
  return res.status(204).end();
});

// ─── GET /api/analytics/:classId ─────────────────────────────────────────────
router.get('/:classId', requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.auth?.userId || req.user?.id;

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          include: { user: { select: { id: true, email: true } } },
        },
        lessons: {
          where: { status: 'READY' },
          select: { id: true, title: true },
        },
      },
    });

    if (!classRecord || classRecord.teacherId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const lessonIds = classRecord.lessons.map((l) => l.id);
    const studentIds = classRecord.enrollments.map((e) => e.userId);

    const engagementCounts = await prisma.engagementEvent.groupBy({
      by: ['eventType'],
      where: { lessonId: { in: lessonIds } },
      _count: { id: true },
    });

    const quizStats = await prisma.quizAttempt.groupBy({
      by: ['level'],
      where: { lessonId: { in: lessonIds } },
      _avg: { score: true },
      _count: { id: true },
    });

    const profileDistribution = await prisma.learnerProfile.groupBy({
      by: ['readingLevel'],
      where: { userId: { in: studentIds } },
      _count: { id: true },
    });

    const mathDistribution = await prisma.learnerProfile.groupBy({
      by: ['mathLevel'],
      where: { userId: { in: studentIds } },
      _count: { id: true },
    });

    const studentActivity = await Promise.all(
      classRecord.enrollments.map(async (enrollment) => {
        const sid = enrollment.userId;

        const viewCount = await prisma.engagementEvent.count({
          where: { userId: sid, lessonId: { in: lessonIds }, eventType: 'VIEW' },
        });

        const quizzes = await prisma.quizAttempt.findMany({
          where: { userId: sid, lessonId: { in: lessonIds } },
          select: { score: true, totalQuestions: true },
        });

        const avgScore =
          quizzes.length > 0
            ? Math.round(
                quizzes.reduce((sum, q) => sum + (q.score / q.totalQuestions) * 100, 0) / quizzes.length
              )
            : null;

        return {
          userId: sid,
          email: enrollment.user.email,
          viewCount,
          quizzesCompleted: quizzes.length,
          avgQuizScore: avgScore,
        };
      })
    );

    const lessonEngagement = await Promise.all(
      classRecord.lessons.map(async (lesson) => {
        const views = await prisma.engagementEvent.count({
          where: { lessonId: lesson.id, eventType: 'VIEW' },
        });
        const quizCompletions = await prisma.engagementEvent.count({
          where: { lessonId: lesson.id, eventType: 'QUIZ_COMPLETE' },
        });
        return { lessonId: lesson.id, title: lesson.title, views, quizCompletions };
      })
    );

    res.json({
      className: classRecord.name,
      totalStudents: studentIds.length,
      totalLessons: lessonIds.length,
      engagementCounts: engagementCounts.map((e) => ({ eventType: e.eventType, count: e._count.id })),
      quizStats: quizStats.map((q) => ({ level: q.level, avgScore: Math.round((q._avg.score || 0) * 100) / 100, attempts: q._count.id })),
      readingLevelDistribution: profileDistribution.map((p) => ({ level: p.readingLevel, count: p._count.id })),
      mathLevelDistribution: mathDistribution.map((p) => ({ level: p.mathLevel, count: p._count.id })),
      studentActivity,
      lessonEngagement,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/analytics/loop-status/:classId ────────────────────────────────
// Returns a snapshot of where the class stands in the 7-step closed loop.
router.get('/loop-status/:classId', requireTeacher, async (req, res) => {
  const { classId } = req.params;
  const userId = req.auth?.userId || req.user?.id;

  try {
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: true,
        lessons: { where: { status: 'READY' }, select: { id: true, publishedAt: true } },
      },
    });

    if (!classRecord || classRecord.teacherId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const totalStudents = classRecord.enrollments.length;
    const lessonIds = classRecord.lessons.map((l) => l.id);
    const publishedLessons = classRecord.lessons.filter((l) => l.publishedAt).length;

    const [diagnosticCount, editCount, quizCount, engagementCount] = await Promise.all([
      prisma.diagnosticAttempt.count({ where: { classId } }),
      prisma.lessonEdit.count({ where: { lessonId: { in: lessonIds } } }),
      prisma.quizAttempt.count({ where: { lessonId: { in: lessonIds } } }),
      prisma.engagementEvent.count({ where: { lessonId: { in: lessonIds } } }),
    ]);

    const diagnosticStudents = await prisma.diagnosticAttempt.groupBy({
      by: ['userId'],
      where: { classId },
    });
    const studentsWithDiagnostic = diagnosticStudents.length;

    const steps = [
      {
        id: 'standards',
        label: 'Standards matched',
        status: lessonIds.length > 0 ? 'complete' : 'pending',
        count: lessonIds.length,
        detail: `${lessonIds.length} lesson${lessonIds.length !== 1 ? 's' : ''} generated`,
      },
      {
        id: 'diagnostics',
        label: 'Diagnostics completed',
        status: studentsWithDiagnostic === 0 ? 'pending' : studentsWithDiagnostic < totalStudents ? 'partial' : 'complete',
        count: studentsWithDiagnostic,
        total: totalStudents,
        detail: `${studentsWithDiagnostic}/${totalStudents} students`,
      },
      {
        id: 'adaptations',
        label: 'Adaptations applied',
        status: publishedLessons > 0 ? 'complete' : 'pending',
        count: publishedLessons,
        detail: `${publishedLessons} lesson${publishedLessons !== 1 ? 's' : ''} published`,
      },
      {
        id: 'signals',
        label: 'Student signals captured',
        status: engagementCount > 0 ? 'complete' : 'pending',
        count: engagementCount,
        detail: `${engagementCount} engagement event${engagementCount !== 1 ? 's' : ''}`,
      },
      {
        id: 'quiz',
        label: 'Quiz responses recorded',
        status: quizCount > 0 ? 'complete' : 'pending',
        count: quizCount,
        detail: `${quizCount} quiz response${quizCount !== 1 ? 's' : ''}`,
      },
      {
        id: 'teacher_feedback',
        label: 'Teacher feedback logged',
        status: editCount > 0 ? 'complete' : 'pending',
        count: editCount,
        detail: `${editCount} section edit${editCount !== 1 ? 's' : ''}`,
      },
    ];

    // Derive next recommended action
    let nextAction = 'Loop is running — keep generating lessons and collecting feedback.';
    const remaining = totalStudents - studentsWithDiagnostic;
    if (remaining > 0) nextAction = `Run diagnostics for ${remaining} remaining student${remaining !== 1 ? 's' : ''}`;
    else if (lessonIds.length === 0) nextAction = 'Generate your first lesson in LessonForge';
    else if (publishedLessons === 0) nextAction = 'Publish a lesson so students can access it';
    else if (quizCount === 0) nextAction = 'Students have not completed any quizzes yet — share the lesson link';

    res.json({
      classId,
      className: classRecord.name,
      steps,
      nextAction,
      loopHealth: steps.filter((s) => s.status === 'complete').length,
      totalSteps: steps.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/analytics/recommendations/:classId ─────────────────────────────
// Claude-generated actionable recommendations based on class stats.
router.get('/recommendations/:classId', requireTeacher, async (req, res) => {
  const { classId } = req.params;
  const userId = req.auth?.userId || req.user?.id;

  try {
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: true,
        lessons: { where: { status: 'READY' }, select: { id: true } },
      },
    });

    if (!classRecord || classRecord.teacherId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const lessonIds = classRecord.lessons.map((l) => l.id);
    const totalStudents = classRecord.enrollments.length;

    const [editsBySection, quizStats, diagnosticStudents] = await Promise.all([
      prisma.lessonEdit.groupBy({
        by: ['section', 'editType'],
        where: { lessonId: { in: lessonIds } },
        _count: { id: true },
      }),
      prisma.quizAttempt.groupBy({
        by: ['level'],
        where: { lessonId: { in: lessonIds } },
        _avg: { score: true },
        _count: { id: true },
      }),
      prisma.diagnosticAttempt.groupBy({ by: ['userId'], where: { classId } }),
    ]);

    const studentsWithDiagnostic = diagnosticStudents.length;
    const mostRewrittenSection = editsBySection
      .filter((e) => e.editType !== 'ACCEPTED_AS_IS')
      .sort((a, b) => b._count.id - a._count.id)[0];

    const statsContext = `
Class: ${classRecord.name}, ${totalStudents} students
Diagnostics completed: ${studentsWithDiagnostic}/${totalStudents}
Most rewritten section: ${mostRewrittenSection ? `${mostRewrittenSection.section} (${mostRewrittenSection._count.id} times)` : 'none yet'}
Quiz stats: ${quizStats.map((q) => `${q.level}: avg ${Math.round((q._avg.score || 0) * 100)}%`).join(', ') || 'no data'}
    `.trim();

    let recommendations;
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system: 'You are a classroom analytics AI. Return ONLY valid JSON with no other text.',
        messages: [
          {
            role: 'user',
            content: `Given these class stats:\n${statsContext}\n\nReturn ONLY: { "recommendations": ["string", "string", "string"], "detectedIssues": ["string"], "urgentAction": "string | null" }`,
          },
        ],
      });

      const rawJson = response.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
      recommendations = JSON.parse(rawJson);
    } catch {
      // Fallback recommendations built from real data
      const recs = [];
      if (studentsWithDiagnostic < totalStudents) {
        recs.push(`${totalStudents - studentsWithDiagnostic} students have not completed a diagnostic — prompt them before the next lesson`);
      }
      if (mostRewrittenSection) {
        recs.push(`Consider simplifying the "${mostRewrittenSection.section.toLowerCase().replace('_', ' ')}" section — it has been rewritten multiple times`);
      }
      recs.push('Review quiz performance by level and adjust lesson difficulty accordingly');
      recommendations = { recommendations: recs, detectedIssues: [], urgentAction: null };
    }

    res.json({ classId, ...recommendations, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
