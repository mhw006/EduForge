#!/usr/bin/env node
/**
 * Pre-generate two backup lessons via Claude, cache the JSON to disk,
 * and insert them into the DB as READY lessons tied to the demo class.
 *
 * Idempotent: re-running uses the cached JSON instead of burning API credits.
 * Safe to run as a fallback prep step right before the demo.
 *
 * Run: npm run backups   (from server/)
 *
 * Output:
 *   - server/prisma/backup-lessons.json  ← cached Claude output
 *   - 2 rows in `Lesson` table with status='READY'
 */
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const { prisma } = require('../src/db');
const { generateLessonStream } = require('../src/services/lessonforge');

const CACHE_PATH = path.join(__dirname, '..', 'prisma', 'backup-lessons.json');

const BACKUPS = [
  {
    id:       'backup_lesson_water_cycle',
    key:      'water_cycle',
    title:    'The Water Cycle',
    standard: 'NGSS MS-ESS2-4 — Develop a model to describe the cycling of water through Earth\'s systems driven by energy from the sun and the force of gravity.',
    grade:    '6',
    subject:  'Science',
  },
  {
    id:       'backup_lesson_industrial_revolution',
    key:      'industrial_revolution',
    title:    'The Industrial Revolution',
    standard: 'C3 D2.His.1.9-12 — Evaluate how historical events and developments were shaped by unique circumstances of time and place as well as broader historical contexts. Focus: Industrial Revolution, 1760–1840.',
    grade:    '10',
    subject:  'History',
  },
];

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch { return {}; }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(`  [cache] saved → ${path.relative(process.cwd(), CACHE_PATH)}`);
}

async function generateOne(spec) {
  return new Promise((resolve, reject) => {
    let printed = 0;
    generateLessonStream(
      spec.standard,
      spec.grade,
      spec.subject,
      (chunk) => {
        printed += chunk.length;
        process.stdout.write(`\r  [stream] ${printed} chars received...`);
      },
      (parsed) => {
        process.stdout.write('\n');
        resolve(parsed);
      },
      (err) => {
        process.stdout.write('\n');
        reject(err);
      }
    );
  });
}

async function main() {
  const cache = loadCache();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hasRealKey = apiKey && apiKey.startsWith('sk-ant-') && apiKey.length > 20 && !apiKey.endsWith('...');

  // Find demo class to attach lessons to
  const demoClass = await prisma.class.findUnique({ where: { joinCode: 'DEMO2024' } });
  if (!demoClass) {
    console.error('✗ Demo class missing — run `npm run seed` first.');
    process.exit(1);
  }
  console.log(`Demo class: ${demoClass.name} (${demoClass.id})\n`);

  for (const spec of BACKUPS) {
    console.log(`━━━ ${spec.title} ━━━`);

    let lessonContent = cache[spec.key];

    if (!lessonContent) {
      if (!hasRealKey) {
        console.log('  ✗ Not in cache and ANTHROPIC_API_KEY is a placeholder.');
        console.log('    Fill in a real key in server/.env, then re-run.');
        continue;
      }
      console.log('  Generating via Claude…');
      try {
        lessonContent = await generateOne(spec);
        cache[spec.key] = lessonContent;
        saveCache(cache);
        console.log(`  ✓ Generated (${Object.keys(lessonContent).length} top-level keys)`);
      } catch (err) {
        console.error(`  ✗ Generation failed: ${err.message}`);
        continue;
      }
    } else {
      console.log('  ✓ Loaded from cache (no API call)');
    }

    // Sanity check the cached/generated content
    if (!lessonContent.foundational || !lessonContent.gradeLevel || !lessonContent.advanced) {
      console.error('  ✗ Lesson missing required levels — skipping DB insert');
      continue;
    }

    // Upsert into DB (so it's idempotent)
    const lesson = await prisma.lesson.upsert({
      where:  { id: spec.id },
      update: {
        title:        lessonContent.title || spec.title,
        status:       'READY',
        foundational: lessonContent.foundational,
        gradeLevel:   lessonContent.gradeLevel,
        advanced:     lessonContent.advanced,
      },
      create: {
        id:           spec.id,
        classId:      demoClass.id,
        standard:     spec.standard,
        title:        lessonContent.title || spec.title,
        status:       'READY',
        foundational: lessonContent.foundational,
        gradeLevel:   lessonContent.gradeLevel,
        advanced:     lessonContent.advanced,
      },
    });
    console.log(`  ✓ DB row: ${lesson.id} (status=${lesson.status})\n`);
  }

  // ── Summary ──
  console.log('━━━ Summary ━━━');
  const all = await prisma.lesson.findMany({
    where: { id: { in: BACKUPS.map((b) => b.id) } },
    select: { id: true, title: true, status: true },
  });
  for (const l of all) console.log(`  ${l.status.padEnd(10)} ${l.id} — ${l.title}`);

  if (all.length === BACKUPS.length) {
    console.log('\n✓ All backup lessons in DB. Demo is fallback-safe.');
  } else {
    console.log(`\n⚠ Only ${all.length}/${BACKUPS.length} lessons present.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Crashed:', err);
  prisma.$disconnect();
  process.exit(1);
});
