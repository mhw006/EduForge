const express = require('express');
const { prisma } = require('../db');
const { requireAuth, requireTeacher } = require('../middleware/auth');

const router = express.Router();

// POST /api/classes — teacher creates a class
router.post('/', requireTeacher, async (req, res) => {
  const { name } = req.body;
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const cls = await prisma.class.create({
    data: { name: name.trim(), teacherId: req.user.id },
  });
  res.status(201).json(cls);
});

// GET /api/classes/mine — teacher's own classes (must come BEFORE /:id route)
router.get('/mine', requireTeacher, async (req, res) => {
  const classes = await prisma.class.findMany({
    where:   { teacherId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { lessons: true, enrollments: true } } },
  });
  res.json(classes);
});

// POST /api/classes/join — student enrolls in a class via joinCode
router.post('/join', requireAuth, async (req, res) => {
  const { joinCode } = req.body;
  if (typeof joinCode !== 'string' || !joinCode.trim()) {
    return res.status(400).json({ error: 'joinCode is required' });
  }

  const cls = await prisma.class.findUnique({ where: { joinCode: joinCode.trim() } });
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const enrollment = await prisma.enrollment.upsert({
    where:  { userId_classId: { userId: req.user.id, classId: cls.id } },
    update: {},
    create: { userId: req.user.id, classId: cls.id },
  });

  res.status(201).json({ class: cls, enrollment });
});

// GET /api/classes/:id/students — teacher views their class roster
router.get('/:id/students', requireTeacher, async (req, res) => {
  const cls = await prisma.class.findFirst({
    where: { id: req.params.id, teacherId: req.user.id },
  });
  if (!cls) return res.status(404).json({ error: 'Class not found or not yours' });

  const enrollments = await prisma.enrollment.findMany({
    where:   { classId: cls.id },
    include: { user: { select: { id: true, email: true, role: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  res.json(enrollments.map((e) => ({ ...e.user, joinedAt: e.joinedAt })));
});

// GET /api/classes/:id — fetch a single class (teacher: must own; student: must be enrolled)
router.get('/:id', requireAuth, async (req, res) => {
  const cls = await prisma.class.findUnique({ where: { id: req.params.id } });
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const isTeacher = cls.teacherId === req.user.id;
  if (!isTeacher) {
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_classId: { userId: req.user.id, classId: cls.id } },
    });
    if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this class' });
  }

  res.json(cls);
});

module.exports = router;
