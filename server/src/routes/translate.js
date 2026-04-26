const express = require('express');
const { protect } = require('../middleware/auth');
const { translateText } = require('../services/deepl');

const router = express.Router();

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'tl', label: 'Tagalog' },
];

router.get('/languages', protect, (req, res) => {
  res.json(SUPPORTED_LANGUAGES);
});

router.post('/', protect, async (req, res, next) => {
  const { text, targetLang } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  if (!targetLang) {
    return res.status(400).json({ error: 'targetLang is required' });
  }

  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'text must be a string' });
  }

  if (text.length > 10000) {
    return res.status(400).json({ error: 'text must be under 10,000 characters' });
  }

  try {
    const translated = await translateText(text, targetLang);
    res.json({ translated, targetLang });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
