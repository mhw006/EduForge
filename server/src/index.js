const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { clerk } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global middleware ───────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(clerk); // populates req.auth.userId for downstream auth middleware

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduForge server running' });
});

app.use('/api/lessons',   require('./routes/lessons'));
app.use('/api/adapt',     require('./routes/adapt'));
app.use('/api/profile',   require('./routes/profile'));
app.use('/api/classes',   require('./routes/classes'));
app.use('/api/translate', require('./routes/translate'));
app.use('/api/quiz',      require('./routes/quiz'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/export',    require('./routes/export'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
