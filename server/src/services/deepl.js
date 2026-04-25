const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

async function translateText(text, targetLang) {
  if (!text || targetLang === 'en') return text;

  const response = await axios.post(
    DEEPL_API_URL,
    new URLSearchParams({
      auth_key:    process.env.DEEPL_API_KEY,
      text,
      target_lang: targetLang.toUpperCase(),
      tag_handling: 'html',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data.translations[0].text;
}

async function translateLesson(content, lessonId, level, targetLang) {
  const cached = await prisma.translationCache.findUnique({
    where: { lessonId_level_targetLang: { lessonId, level, targetLang } }
  });
  if (cached) return cached.content;

  const [overview, mainContent, ...activityInstructions] = await Promise.all([
    translateText(content.overview, targetLang),
    translateText(content.mainContent, targetLang),
    ...content.activities.map(a => translateText(a.instructions, targetLang)),
  ]);

  const keyVocabulary = await Promise.all(
    content.keyVocabulary.map(async (v) => ({
      term:       await translateText(v.term, targetLang),
      definition: await translateText(v.definition, targetLang),
    }))
  );

  const quiz = await Promise.all(
    content.quiz.map(async (q) => ({
      question:      await translateText(q.question, targetLang),
      options:       await Promise.all(q.options.map(o => translateText(o, targetLang))),
      correctAnswer: q.correctAnswer,
      explanation:   await translateText(q.explanation, targetLang),
    }))
  );

  const translated = {
    ...content,
    overview,
    mainContent,
    keyVocabulary,
    activities: content.activities.map((a, i) => ({ ...a, instructions: activityInstructions[i] })),
    quiz,
    _translated: true,
    _targetLang: targetLang,
  };

  await prisma.translationCache.create({
    data: { lessonId, level, targetLang, content: translated }
  });

  return translated;
}

module.exports = { translateLesson, translateText };
