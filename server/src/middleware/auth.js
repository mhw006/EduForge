const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');
const { prisma } = require('../db');

// In dev, if no real Clerk keys are configured, bypass auth and inject a demo user.
const hasRealClerkKeys =
  process.env.CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.CLERK_PUBLISHABLE_KEY.length > 10 &&
  !process.env.CLERK_PUBLISHABLE_KEY.endsWith('...');

const clerk = hasRealClerkKeys
  ? clerkMiddleware()
  : (req, _res, next) => next();

async function requireAuth(req, res, next) {
  // Dev bypass — pick demo teacher unless caller asked for student via header
  if (!hasRealClerkKeys) {
    const demoId = req.headers['x-demo-user'] === 'student' ? 'demo_student_001' : 'demo_teacher_001';
    req.user = await prisma.user.findUnique({ where: { id: demoId } });
    if (!req.user) return res.status(500).json({ error: 'Demo user missing — run `npm run seed`' });
    req.auth = { userId: req.user.id };
    return next();
  }

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const clerkUser = await clerkClient.users.getUser(userId);
    user = await prisma.user.create({
      data: {
        id: userId,
        email: clerkUser.emailAddresses[0].emailAddress,
        role: 'STUDENT',
      },
    });
  }

  req.user = user;
  req.auth = { userId: user.id }; // expose req.auth.userId for routes using Clerk-style access
  next();
}

async function requireTeacher(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.role !== 'TEACHER' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Teacher role required' });
    }
    next();
  });
}

async function requireStudent(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Student role required' });
    }
    next();
  });
}

// Alias used by other team members' route files
const protect = requireAuth;

module.exports = { clerk, requireAuth, requireTeacher, requireStudent, protect };
