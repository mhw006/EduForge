const axios = require('axios');
const { prisma } = require('../db');

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';
const DEEPL_LANG_MAP = {
  pt: 'PT-BR',
  zh: 'ZH',
  en: 'EN-US',
};

function getDeepLLanguage(targetLang) {
  if (!targetLang || typeof targetLang !== 'string') return targetLang;
  const normalized = targetLang.trim().toLowerCase();
  return DEEPL_LANG_MAP[normalized] || normalized.toUpperCase();
}

function hasDeepLKey() {
  return Boolean(process.env.DEEPL_API_KEY && process.env.DEEPL_API_KEY.trim());
}

function isEnglish(targetLang) {
  return typeof targetLang === 'string' && targetLang.trim().toLowerCase() === 'en';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function markTranslationFailed(content) {
  return {
    ...(content || {}),
    _translationFailed: true,
  };
}

function isUniqueConstraintError(err) {
  return err && err.code === 'P2002';
}

function getDeepLErrorMessage(err) {
  const deeplMessage = err.response?.data?.message;
  const status = err.response?.status;

  if (deeplMessage && status) return `${status}: ${deeplMessage}`;
  if (deeplMessage) return deeplMessage;
  if (status) return `HTTP ${status}`;
  return err.message || 'Unknown DeepL error';
}

async function requestDeepLTranslation(text, targetLang) {
  const response = await axios.post(
    DEEPL_API_URL,
    {
      text: [text],
      target_lang: getDeepLLanguage(targetLang),
      tag_handling: 'html',
    },
    {
      headers: {
        Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data?.translations?.[0]?.text || text;
}

async function translateText(text, targetLang) {
  if (!text || !targetLang || isEnglish(targetLang)) return text;

  if (!hasDeepLKey()) {
    console.warn('DeepL translation skipped: DEEPL_API_KEY is not configured.');
    return text;
  }

  try {
    return await requestDeepLTranslation(text, targetLang);
  } catch (err) {
    console.warn(`DeepL translation failed: ${getDeepLErrorMessage(err)}`);
    return text;
  }
}

async function translateLessonText(text, targetLang) {
  if (!text || !targetLang || isEnglish(targetLang)) return text;
  return requestDeepLTranslation(text, targetLang);
}

async function translateVocabularyItem(item, targetLang) {
  const [term, definition] = await Promise.all([
    translateLessonText(item?.term, targetLang),
    translateLessonText(item?.definition, targetLang),
  ]);

  return {
    ...item,
    term,
    definition,
  };
}

async function translateActivity(activity, targetLang) {
  const instructions = await translateLessonText(activity?.instructions, targetLang);

  return {
    ...activity,
    instructions,
  };
}

async function translateQuizItem(item, targetLang) {
  const [question, options, explanation] = await Promise.all([
    translateLessonText(item?.question, targetLang),
    Promise.all(asArray(item?.options).map((option) => translateLessonText(option, targetLang))),
    translateLessonText(item?.explanation, targetLang),
  ]);

  return {
    ...item,
    question,
    options,
    explanation,
  };
}

async function readCachedLesson(lessonId, level, targetLang) {
  if (!lessonId || !level || !targetLang) return null;

  return prisma.translationCache.findUnique({
    where: {
      lessonId_level_targetLang: {
        lessonId,
        level,
        targetLang,
      },
    },
  });
}

async function cacheTranslatedLesson(lessonId, level, targetLang, content) {
  if (!lessonId || !level || !targetLang) return null;

  try {
    return await prisma.translationCache.create({
      data: {
        lessonId,
        level,
        targetLang,
        content,
      },
    });
  } catch (err) {
    if (!isUniqueConstraintError(err)) {
      console.warn(`Translation cache write failed: ${err.message}`);
      return null;
    }

    const cached = await readCachedLesson(lessonId, level, targetLang);
    return cached;
  }
}

// Translate an entire lesson level in ONE DeepL API call by collecting all
// text strings into a single array request, then mapping results back.
async function translateLesson(content, lessonId, level, targetLang) {
  if (!content || !targetLang || isEnglish(targetLang)) return content;

  try {
    const cached = await readCachedLesson(lessonId, level, targetLang);
    if (cached && !cached.content?._translationFailed) return cached.content;
  } catch (err) {
    console.warn(`Translation cache lookup failed: ${err.message}`);
  }

  if (!hasDeepLKey()) {
    console.warn('Lesson translation skipped: DEEPL_API_KEY is not configured.');
    return markTranslationFailed(content);
  }

  try {
    const vocab = asArray(content.keyVocabulary);
    const activities = asArray(content.activities);
    const quiz = asArray(content.quiz);

    // Collect every text that needs translation into a flat array
    const texts = [
      content.overview || '',
      content.mainContent || '',
      ...vocab.flatMap((v) => [v.term || '', v.definition || '']),
      ...activities.map((a) => a.instructions || ''),
      ...quiz.flatMap((q) => [q.question || '', ...asArray(q.options), q.explanation || '']),
    ];

    // Single API call with all texts at once
    const response = await axios.post(
      DEEPL_API_URL,
      {
        text: texts,
        target_lang: getDeepLLanguage(targetLang),
        tag_handling: 'html',
      },
      {
        headers: {
          Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const results = response.data.translations.map((t) => t.text);
    let i = 0;
    const take = () => results[i++] ?? '';

    const translated = {
      ...content,
      overview: take(),
      mainContent: take(),
      keyVocabulary: vocab.map((v) => ({ ...v, term: take(), definition: take() })),
      activities: activities.map((a) => ({ ...a, instructions: take() })),
      quiz: quiz.map((q) => {
        const question = take();
        const options = asArray(q.options).map(() => take());
        const explanation = take();
        return { ...q, question, options, explanation };
      }),
      _translated: true,
      _targetLang: targetLang,
    };

    await cacheTranslatedLesson(lessonId, level, targetLang, translated);
    return translated;
  } catch (err) {
    console.warn(`Lesson translation failed: ${err.message}`);
    return markTranslationFailed(content);
  }
}

module.exports = { translateText, translateLesson };
