const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');
const { prisma } = require('../db');

// In dev, if no real Clerk keys are configured, bypass auth and inject a demo teacher.
// Person 4 fills in CLERK_PUBLISHABLE_KEY/CLERK_SECRET_KEY when ready.
const hasRealClerkKeys =
  process.env.CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  process.env.CLERK_PUBLISHABLE_KEY.length > 10 &&
  !process.env.CLERK_PUBLISHABLE_KEY.endsWith('...');

const clerk = hasRealClerkKeys
  ? clerkMiddleware()
  : (req, _res, next) => next(); // no-op in dev

async function requireAuth(req, res, next) {
  // Dev bypass: no real Clerk keys → use seeded demo teacher
  if (!hasRealClerkKeys) {
    req.user = await prisma.user.findUnique({ where: { id: 'demo_teacher_001' } });
    if (!req.user) return res.status(500).json({ error: 'Demo user missing — run `npm run seed`' });
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

module.exports = { clerk, requireAuth, requireTeacher };
