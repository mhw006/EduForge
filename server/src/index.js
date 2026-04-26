const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { clerk } = require('./middleware/auth');
const prisma = require('./lib/prisma');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global middleware ───────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(clerk);

// ─── Rate limiters ───────────────────────────────────────────────────────────
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many generation requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many translation requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduForge server running', timestamp: new Date().toISOString() });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/chat', require('./routes/chat'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/lessonforge', generateLimiter, require('./routes/lessonforge'));
app.use('/api/equity', generateLimiter, require('./routes/equity'));
app.use('/api/adapt', require('./routes/adapt'));
app.use('/api/translate', translateLimiter, require('./routes/translate'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/export', require('./routes/export'));
app.use('/api/diagnostics', require('./routes/diagnostics'));
app.use('/api/edits', require('./routes/edits'));
app.use('/api/standards', require('./routes/standards'));

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ─── Start server ────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`EduForge server running on http://localhost:${PORT}`);
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database disconnected. Goodbye.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
