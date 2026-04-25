const express = require('express');
const { protect } = require('../middleware/auth');
const { translateText } = require('../services/translate');
const router = express.Router();

// ─── POST /api/translate ─────────────────────────────────────────────────────
// Standalone translation endpoint (used for ad-hoc text translation)
router.post('/', protect, async (req, res) => {
  const { text, targetLang, lessonId, level } = req.body;

  if (!text || !targetLang) {
    return res.status(400).json({ error: 'text and targetLang are required' });
  }

  if (text.length > 10000) {
    return res.status(400).json({ error: 'Text must be under 10,000 characters' });
  }

  try {
    const translated = await translateText(text, targetLang, { lessonId, level });
    res.json({ translated, targetLang });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;