const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduForge server running' });
});

// Routes (add as you build them)
app.use('/api/lessons', require('./routes/lessons'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});