const axios = require('axios');
const { prisma } = require('../db');
const { uploadToR2, getPublicUrl } = require('./storage');

function buildTtsScript(content) {
  return [content.overview, content.mainContent]
    .filter(Boolean)
    .join('\n\n');
}

async function generateAudio(lessonId, level, language, content, userId) {
  const cached = await prisma.audioCache.findUnique({
    where: { lessonId_level_language: { lessonId, level, language } }
  });
  if (cached) return getPublicUrl(cached.storageKey);

  const script = buildTtsScript(content);
  const MAX_CHARS = 4500;

  if (script.length > MAX_CHARS) {
    console.warn(`TTS script too long (${script.length} chars), truncating to ${MAX_CHARS}`);
  }

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
    {
      text: script.substring(0, MAX_CHARS),
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    },
    {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
    }
  );

  const storageKey = `audio/${lessonId}/${level}/${language}.mp3`;
  await uploadToR2(storageKey, Buffer.from(response.data), 'audio/mpeg');

  await prisma.audioCache.create({
    data: { lessonId, userId, level, language, storageKey }
  });

  return getPublicUrl(storageKey);
}

module.exports = { generateAudio };
