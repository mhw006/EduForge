const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { clerk } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global middleware ───────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(clerk);

// Clerk session must run before any route that calls getAuth()
app.use(clerk);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduForge server running' });
});

app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/adapt', require('./routes/adapt'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
