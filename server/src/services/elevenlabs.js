const axios = require('axios');

function hasR2() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function buildTtsScript(content) {
  return [content.overview, content.mainContent]
    .filter(Boolean)
    .join('\n\n');
}

async function generateAudio(lessonId, level, language, content, userId) {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
    throw new Error('ElevenLabs not configured');
  }

  // R2 caching path — only when storage credentials are available
  if (hasR2()) {
    const { prisma } = require('../db');
    const { uploadToR2, getPublicUrl } = require('./storage');

    const cached = await prisma.audioCache.findUnique({
      where: { lessonId_level_language: { lessonId, level, language } },
    });
    if (cached) return { url: getPublicUrl(cached.storageKey) };

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
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
      }
    );

    const storageKey = `audio/${lessonId}/${level}/${language}.mp3`;
    await uploadToR2(storageKey, Buffer.from(response.data), 'audio/mpeg');
    await prisma.audioCache.create({ data: { lessonId, userId, level, language, storageKey } });
    return { url: getPublicUrl(storageKey) };
  }

  // No R2 — return audio as base64 data URL directly
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
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
    }
  );

  const base64 = Buffer.from(response.data).toString('base64');
  return { url: `data:audio/mpeg;base64,${base64}` };
}

module.exports = { generateAudio };
