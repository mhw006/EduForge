const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@demo.com' },
    update: {},
    create: {
      id: 'demo_teacher_001',
      email: 'teacher@demo.com',
      role: 'TEACHER',
    },
  });

  const demoClass = await prisma.class.upsert({
    where: { joinCode: 'DEMO2024' },
    update: {},
    create: {
      name: '6th Grade ELA — Period 3',
      joinCode: 'DEMO2024',
      teacherId: teacher.id,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@demo.com' },
    update: {},
    create: {
      id: 'demo_student_001',
      email: 'student@demo.com',
      role: 'STUDENT',
      profile: {
        create: {
          readingLevel: 'FOUNDATIONAL',
          language: 'es',
          bandwidthMode: 'TEXT_ONLY',
          fontSize: 'LARGE',
          dyslexiaFont: true,
          ttsEnabled: true,
          ttsProvider: 'WEB_SPEECH',
        },
      },
    },
  });

  console.log('Seed complete:', { teacher, demoClass, student });
}

main().catch(console.error).finally(() => prisma.$disconnect());
