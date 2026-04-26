const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { prisma } = require('../db');

// In dev, if no real Clerk keys are configured, bypass auth and inject a demo user.
const hasRealClerkKeys =
  process.env.CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.CLERK_PUBLISHABLE_KEY.length > 10 &&
  !process.env.CLERK_PUBLISHABLE_KEY.endsWith('...');

function isDemoAuthAllowed() {
  return (
    process.env.ALLOW_DEMO_AUTH === 'true' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')
  );
}

function getRequestedDemoUser(req) {
  if (process.env.DISABLE_DEMO_AUTH === 'true') return null;
  const requested = req.headers['x-demo-user'];
  if (requested === 'student') return 'demo_student_001';
  if (requested === 'teacher') return 'demo_teacher_001';
  if (!isDemoAuthAllowed()) return null;
  return null;
}

const clerk = hasRealClerkKeys
  ? (isDemoAuthAllowed() ? (req, _res, next) => next() : clerkMiddleware())
  : (req, _res, next) => next();

const DEMO_USERS = {
  demo_teacher_001: { id: 'demo_teacher_001', role: 'TEACHER', email: 'teacher@demo.eduforge.app', name: 'Demo Teacher' },
  demo_student_001: { id: 'demo_student_001', role: 'STUDENT', email: 'student@demo.eduforge.app', name: 'Demo Student' },
};

async function requireAuth(req, res, next) {
  const requestedDemoUser = getRequestedDemoUser(req);
  if (requestedDemoUser) {
    // Use hardcoded demo user — no DB required, works even if Supabase is unreachable.
    req.user = DEMO_USERS[requestedDemoUser] || DEMO_USERS['demo_student_001'];
    req.auth = { userId: req.user.id };
    return next();
  }

  const { userId } = hasRealClerkKeys ? getAuth(req) : { userId: null };

  if (!userId && isDemoAuthAllowed()) {
    const demoId = req.headers['x-demo-user'] === 'student' ? 'demo_student_001' : 'demo_teacher_001';
    req.user = DEMO_USERS[demoId];
    req.auth = { userId: req.user.id };
    return next();
  }

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
