const express = require('express');
const prisma = require('../lib/prisma');
const { protect, requireTeacher, requireStudent } = require('../middleware/auth');
const router = express.Router();

// ─── POST /api/classes ───────────────────────────────────────────────────────
// Teacher creates a new class
router.post('/', protect, requireTeacher, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Class name is required' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'Class name must be under 100 characters' });
    }

    const newClass = await prisma.class.create({
      data: {
        name: name.trim(),
        teacherId: req.auth.userId,
      },
    });

    res.status(201).json({
      id: newClass.id,
      name: newClass.name,
      joinCode: newClass.joinCode,
      createdAt: newClass.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/classes/join ──────────────────────────────────────────────────
// Student joins a class by code
router.post('/join', protect, requireStudent, async (req, res) => {
  try {
    const { joinCode } = req.body;

    if (!joinCode) {
      return res.status(400).json({ error: 'joinCode is required' });
    }

    const classRecord = await prisma.class.findUnique({
      where: { joinCode },
    });

    if (!classRecord) {
      return res.status(404).json({ error: 'Invalid class code' });
    }

    // Check if already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_classId: {
          userId: req.auth.userId,
          classId: classRecord.id,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Already enrolled in this class' });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId: req.auth.userId,
        classId: classRecord.id,
      },
    });

    res.status(201).json({
      classId: classRecord.id,
      className: classRecord.name,
      joinedAt: enrollment.joinedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/classes ────────────────────────────────────────────────────────
// List classes for current user (taught or enrolled)
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.auth.userId;

    // Get user role
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user?.role === 'TEACHER') {
      const classes = await prisma.class.findMany({
        where: { teacherId: userId },
        include: {
          _count: {
            select: {
              enrollments: true,
              lessons: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json({
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          joinCode: c.joinCode,
          studentCount: c._count.enrollments,
          lessonCount: c._count.lessons,
          createdAt: c.createdAt,
        })),
      });
    }

    // Student — show enrolled classes
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        class: {
          include: {
            teacher: { select: { email: true } },
            _count: { select: { lessons: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    res.json({
      classes: enrollments.map((e) => ({
        id: e.class.id,
        name: e.class.name,
        teacherEmail: e.class.teacher.email,
        lessonCount: e.class._count.lessons,
        joinedAt: e.joinedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;