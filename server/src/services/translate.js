const axios = require('axios');
const prisma = require('../lib/prisma');

/**
 * Translate text via DeepL with database caching.
 * If lessonId + level are provided, checks TranslationCache first.
 */
async function translateText(text, targetLang, { lessonId, level } = {}) {
  const lang = targetLang.toUpperCase();

  // Skip if already English
  if (lang === 'EN' || lang === 'EN-US' || lang === 'EN-GB') {
    return text;
  }

  // Check cache if we have lesson context
  if (lessonId && level) {
    try {
      const cached = await prisma.translationCache.findUnique({
        where: {
          lessonId_level_targetLang: { lessonId, level, targetLang: lang },
        },
      });
      if (cached) {
        return cached.content;
      }
    } catch (err) {
      console.warn('Translation cache lookup failed:', err.message);
    }
  }

  // Call DeepL
  const response = await axios.post(
    'https://api-free.deepl.com/v2/translate',
    { text: Array.isArray(text) ? text : [text], target_lang: lang },
    {
      headers: {
        Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const translated = Array.isArray(text)
    ? response.data.translations.map((t) => t.text)
    : response.data.translations[0].text;

  // Cache the result if we have lesson context
  if (lessonId && level) {
    try {
      await prisma.translationCache.create({
        data: {
          lessonId,
          level,
          targetLang: lang,
          content: translated,
        },
      });
    } catch (err) {
      // Unique constraint race condition — fine to ignore
      console.warn('Translation cache write failed:', err.message);
    }
  }

  return translated;
}

module.exports = { translateText };