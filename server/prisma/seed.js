require('dotenv').config();
const { prisma } = require('../src/db');

async function main() {
  // Create demo teacher
  const teacher = await prisma.user.upsert({
    where: { id: 'demo_teacher_001' },
    update: {},
    create: {
      id: 'demo_teacher_001',
      email: 'teacher@demo.com',
      role: 'TEACHER',
    },
  });
  console.log('Teacher:', teacher.email);

  // Create demo class
  const demoClass = await prisma.class.upsert({
    where: { joinCode: 'DEMO2024' },
    update: {},
    create: {
      name: '6th Grade ELA — Period 3',
      joinCode: 'DEMO2024',
      teacherId: teacher.id,
    },
  });
  console.log('Class:', demoClass.name, '| Join code:', demoClass.joinCode);

  // Create demo student with profile
  const student = await prisma.user.upsert({
    where: { id: 'demo_student_001' },
    update: {
      email: 'student@demo.com',
      role: 'STUDENT',
      profile: {
        upsert: {
          update: {
            readingLevel: 'FOUNDATIONAL',
            diagnosticReadingLevel: 'FOUNDATIONAL',
            gradeLevelLabel: '6',
            readingLexile: 520,
            mathLevel: 'BELOW_GRADE',
            diagnosticMathLevel: 'BELOW_GRADE',
            language: 'es',
            bandwidthMode: 'TEXT_ONLY',
            fontSize: 'LARGE',
            dyslexiaFont: true,
            screenReaderMode: false,
            reducedMotion: false,
            preferredContentFormat: 'TEXT_FOCUSED',
            supportFlags: {
              translatedContent: true,
              explicitVocabularySupport: true,
            },
            ttsEnabled: true,
            ttsProvider: 'WEB_SPEECH',
          },
          create: {
            readingLevel: 'FOUNDATIONAL',
            diagnosticReadingLevel: 'FOUNDATIONAL',
            gradeLevelLabel: '6',
            readingLexile: 520,
            mathLevel: 'BELOW_GRADE',
            diagnosticMathLevel: 'BELOW_GRADE',
            language: 'es',
            bandwidthMode: 'TEXT_ONLY',
            fontSize: 'LARGE',
            dyslexiaFont: true,
            screenReaderMode: false,
            reducedMotion: false,
            preferredContentFormat: 'TEXT_FOCUSED',
            supportFlags: {
              translatedContent: true,
              explicitVocabularySupport: true,
            },
            ttsEnabled: true,
            ttsProvider: 'WEB_SPEECH',
          },
        },
      },
    },
    create: {
      id: 'demo_student_001',
      email: 'student@demo.com',
      role: 'STUDENT',
      profile: {
        create: {
          readingLevel: 'FOUNDATIONAL',
          diagnosticReadingLevel: 'FOUNDATIONAL',
          gradeLevelLabel: '6',
          readingLexile: 520,
          mathLevel: 'BELOW_GRADE',
          diagnosticMathLevel: 'BELOW_GRADE',
          language: 'es',
          bandwidthMode: 'TEXT_ONLY',
          fontSize: 'LARGE',
          dyslexiaFont: true,
          screenReaderMode: false,
          reducedMotion: false,
          preferredContentFormat: 'TEXT_FOCUSED',
          supportFlags: {
            translatedContent: true,
            explicitVocabularySupport: true,
          },
          ttsEnabled: true,
          ttsProvider: 'WEB_SPEECH',
        },
      },
    },
  });
  console.log('Student:', student.email);

  // Enroll student in class
  await prisma.enrollment.upsert({
    where: {
      userId_classId: { userId: student.id, classId: demoClass.id },
    },
    update: {},
    create: {
      userId: student.id,
      classId: demoClass.id,
    },
  });
  console.log('Student enrolled in class');

  // Create a sample ready lesson for testing
  const sampleLesson = await prisma.lesson.upsert({
    where: { id: 'demo_lesson_001' },
    update: {
      classId: demoClass.id,
      standard: 'CCSS.ELA-LITERACY.RI.6.1',
      title: 'Citing Textual Evidence',
      status: 'READY',
      publishedAt: new Date(),
      publishedById: teacher.id,
      foundational: {
        levelLabel: 'Foundational',
        lexileRange: '400L-600L',
        overview: 'Learn how to find evidence in a text to support your ideas.',
        keyVocabulary: [
          { term: 'evidence', definition: 'A fact or detail from the text that proves something.' },
          { term: 'cite', definition: 'To point to where you found information in the text.' },
        ],
        mainContent:
          'When you read a story or article, the author gives you clues. These clues are called evidence. Good readers find these clues and use them to explain their thinking.',
        activities: [
          { title: 'Highlight Hunt', instructions: 'Read the passage and highlight 3 pieces of evidence.', estimatedMinutes: 10 },
        ],
        quiz: [
          { question: 'What is textual evidence?', options: ['A) Your opinion', 'B) A fact from the text', 'C) A guess', 'D) A picture'], correctAnswer: 'B', explanation: 'Evidence comes directly from the text.' },
          { question: 'Why do we cite evidence?', options: ['A) To fill space', 'B) To prove our ideas', 'C) To copy the author', 'D) To make it longer'], correctAnswer: 'B', explanation: 'Citing evidence supports your claims.' },
          { question: 'Where do you find evidence?', options: ['A) In your head', 'B) On the internet', 'C) In the text', 'D) From a friend'], correctAnswer: 'C', explanation: 'Textual evidence is found in the reading.' },
          { question: 'What does "cite" mean?', options: ['A) To copy', 'B) To point to the source', 'C) To delete', 'D) To ignore'], correctAnswer: 'B', explanation: 'Citing means showing where you found information.' },
          { question: 'Which is the best evidence?', options: ['A) I think so', 'B) My friend said', 'C) The text says on page 2', 'D) It seems right'], correctAnswer: 'C', explanation: 'Direct quotes or page references are strongest.' },
        ],
      },
      gradeLevel: {
        levelLabel: 'Grade Level',
        lexileRange: '700L-900L',
        overview: 'Students will analyze informational text to identify and cite evidence that supports their analysis.',
        keyVocabulary: [
          { term: 'textual evidence', definition: 'Specific details, quotes, or data from a text used to support a claim.' },
          { term: 'inference', definition: 'A conclusion drawn from evidence and reasoning rather than from explicit statements.' },
        ],
        mainContent:
          'Effective readers do more than summarize — they analyze. When making a claim about a text, you must support it with evidence drawn directly from the source material. This means identifying relevant passages, quoting accurately, and explaining how the evidence connects to your point.',
        activities: [
          { title: 'Evidence Chart', instructions: 'Create a two-column chart: Claim on the left, Evidence on the right. Find 3 claims and supporting quotes.', estimatedMinutes: 15 },
        ],
        quiz: [
          { question: 'What makes evidence "textual"?', options: ['A) It is typed', 'B) It comes from a text', 'C) It is long', 'D) It is highlighted'], correctAnswer: 'B', explanation: 'Textual evidence comes directly from the reading material.' },
          { question: 'What is an inference?', options: ['A) A direct quote', 'B) A guess with no basis', 'C) A conclusion from evidence', 'D) A summary'], correctAnswer: 'C', explanation: 'Inferences combine evidence with reasoning.' },
          { question: 'When should you cite evidence?', options: ['A) Only in essays', 'B) When making any claim', 'C) Only when asked', 'D) Never in discussions'], correctAnswer: 'B', explanation: 'Any analytical claim should be supported.' },
          { question: 'Which is strongest evidence?', options: ['A) "I believe..."', 'B) "Everyone knows..."', 'C) "According to paragraph 3..."', 'D) "It seems like..."'], correctAnswer: 'C', explanation: 'Citing specific locations strengthens your argument.' },
          { question: 'How do you explain evidence?', options: ['A) Just quote it', 'B) Connect it to your claim', 'C) Summarize the whole text', 'D) Repeat the question'], correctAnswer: 'B', explanation: 'Evidence must be tied back to the claim it supports.' },
        ],
      },
      advanced: {
        levelLabel: 'Advanced',
        lexileRange: '1000L-1200L',
        overview: 'Students will evaluate the strength of textual evidence and synthesize multiple sources to construct nuanced arguments.',
        keyVocabulary: [
          { term: 'synthesis', definition: 'Combining ideas from multiple sources to form a new understanding or argument.' },
          { term: 'corroborate', definition: 'To confirm or support a claim by providing additional evidence from another source.' },
        ],
        mainContent:
          'Advanced readers evaluate not just what the text says, but the quality and sufficiency of the evidence it provides. Does the author rely on anecdotal evidence or empirical data? Are counterarguments addressed? When synthesizing across texts, consider how different authors use evidence to support divergent conclusions about the same topic.',
        activities: [
          { title: 'Source Comparison', instructions: 'Read two articles on the same topic. Identify where their evidence aligns and where it conflicts. Write a paragraph synthesizing both perspectives.', estimatedMinutes: 20 },
        ],
        quiz: [
          { question: 'What does it mean to synthesize evidence?', options: ['A) Summarize one source', 'B) Combine multiple sources into a new argument', 'C) Copy quotes', 'D) Ignore conflicting evidence'], correctAnswer: 'B', explanation: 'Synthesis creates new understanding from multiple inputs.' },
          { question: 'What does "corroborate" mean?', options: ['A) To contradict', 'B) To confirm with additional evidence', 'C) To summarize', 'D) To question'], correctAnswer: 'B', explanation: 'Corroboration strengthens claims through additional support.' },
          { question: 'Which evidence type is generally strongest?', options: ['A) Anecdotal', 'B) Empirical', 'C) Hypothetical', 'D) Personal opinion'], correctAnswer: 'B', explanation: 'Empirical evidence is based on observation and data.' },
          { question: 'Why address counterarguments?', options: ['A) To weaken your position', 'B) To show you considered multiple perspectives', 'C) To confuse the reader', 'D) It is not necessary'], correctAnswer: 'B', explanation: 'Addressing counterarguments strengthens your argument.' },
          { question: 'How do you evaluate evidence quality?', options: ['A) Check if it is long', 'B) Check source reliability and relevance', 'C) Count the number of quotes', 'D) See if it agrees with you'], correctAnswer: 'B', explanation: 'Quality depends on the source and its relevance to the claim.' },
        ],
      },
    },
    create: {
      id: 'demo_lesson_001',
      classId: demoClass.id,
      standard: 'CCSS.ELA-LITERACY.RI.6.1',
      title: 'Citing Textual Evidence',
      status: 'READY',
      publishedAt: new Date(),
      publishedById: teacher.id,
      foundational: {
        levelLabel: 'Foundational',
        lexileRange: '400L-600L',
        overview: 'Learn how to find evidence in a text to support your ideas.',
        keyVocabulary: [
          { term: 'evidence', definition: 'A fact or detail from the text that proves something.' },
          { term: 'cite', definition: 'To point to where you found information in the text.' },
        ],
        mainContent:
          'When you read a story or article, the author gives you clues. These clues are called evidence. Good readers find these clues and use them to explain their thinking.',
        activities: [
          { title: 'Highlight Hunt', instructions: 'Read the passage and highlight 3 pieces of evidence.', estimatedMinutes: 10 },
        ],
        quiz: [
          { question: 'What is textual evidence?', options: ['A) Your opinion', 'B) A fact from the text', 'C) A guess', 'D) A picture'], correctAnswer: 'B', explanation: 'Evidence comes directly from the text.' },
          { question: 'Why do we cite evidence?', options: ['A) To fill space', 'B) To prove our ideas', 'C) To copy the author', 'D) To make it longer'], correctAnswer: 'B', explanation: 'Citing evidence supports your claims.' },
          { question: 'Where do you find evidence?', options: ['A) In your head', 'B) On the internet', 'C) In the text', 'D) From a friend'], correctAnswer: 'C', explanation: 'Textual evidence is found in the reading.' },
          { question: 'What does "cite" mean?', options: ['A) To copy', 'B) To point to the source', 'C) To delete', 'D) To ignore'], correctAnswer: 'B', explanation: 'Citing means showing where you found information.' },
          { question: 'Which is the best evidence?', options: ['A) I think so', 'B) My friend said', 'C) The text says on page 2', 'D) It seems right'], correctAnswer: 'C', explanation: 'Direct quotes or page references are strongest.' },
        ],
      },
      gradeLevel: {
        levelLabel: 'Grade Level',
        lexileRange: '700L-900L',
        overview: 'Students will analyze informational text to identify and cite evidence that supports their analysis.',
        keyVocabulary: [
          { term: 'textual evidence', definition: 'Specific details, quotes, or data from a text used to support a claim.' },
          { term: 'inference', definition: 'A conclusion drawn from evidence and reasoning rather than from explicit statements.' },
        ],
        mainContent:
          'Effective readers do more than summarize — they analyze. When making a claim about a text, you must support it with evidence drawn directly from the source material. This means identifying relevant passages, quoting accurately, and explaining how the evidence connects to your point.',
        activities: [
          { title: 'Evidence Chart', instructions: 'Create a two-column chart: Claim on the left, Evidence on the right. Find 3 claims and supporting quotes.', estimatedMinutes: 15 },
        ],
        quiz: [
          { question: 'What makes evidence "textual"?', options: ['A) It is typed', 'B) It comes from a text', 'C) It is long', 'D) It is highlighted'], correctAnswer: 'B', explanation: 'Textual evidence comes directly from the reading material.' },
          { question: 'What is an inference?', options: ['A) A direct quote', 'B) A guess with no basis', 'C) A conclusion from evidence', 'D) A summary'], correctAnswer: 'C', explanation: 'Inferences combine evidence with reasoning.' },
          { question: 'When should you cite evidence?', options: ['A) Only in essays', 'B) When making any claim', 'C) Only when asked', 'D) Never in discussions'], correctAnswer: 'B', explanation: 'Any analytical claim should be supported.' },
          { question: 'Which is strongest evidence?', options: ['A) "I believe..."', 'B) "Everyone knows..."', 'C) "According to paragraph 3..."', 'D) "It seems like..."'], correctAnswer: 'C', explanation: 'Citing specific locations strengthens your argument.' },
          { question: 'How do you explain evidence?', options: ['A) Just quote it', 'B) Connect it to your claim', 'C) Summarize the whole text', 'D) Repeat the question'], correctAnswer: 'B', explanation: 'Evidence must be tied back to the claim it supports.' },
        ],
      },
      advanced: {
        levelLabel: 'Advanced',
        lexileRange: '1000L-1200L',
        overview: 'Students will evaluate the strength of textual evidence and synthesize multiple sources to construct nuanced arguments.',
        keyVocabulary: [
          { term: 'synthesis', definition: 'Combining ideas from multiple sources to form a new understanding or argument.' },
          { term: 'corroborate', definition: 'To confirm or support a claim by providing additional evidence from another source.' },
        ],
        mainContent:
          'Advanced readers evaluate not just what the text says, but the quality and sufficiency of the evidence it provides. Does the author rely on anecdotal evidence or empirical data? Are counterarguments addressed? When synthesizing across texts, consider how different authors use evidence to support divergent conclusions about the same topic.',
        activities: [
          { title: 'Source Comparison', instructions: 'Read two articles on the same topic. Identify where their evidence aligns and where it conflicts. Write a paragraph synthesizing both perspectives.', estimatedMinutes: 20 },
        ],
        quiz: [
          { question: 'What does it mean to synthesize evidence?', options: ['A) Summarize one source', 'B) Combine multiple sources into a new argument', 'C) Copy quotes', 'D) Ignore conflicting evidence'], correctAnswer: 'B', explanation: 'Synthesis creates new understanding from multiple inputs.' },
          { question: 'What does "corroborate" mean?', options: ['A) To contradict', 'B) To confirm with additional evidence', 'C) To summarize', 'D) To question'], correctAnswer: 'B', explanation: 'Corroboration strengthens claims through additional support.' },
          { question: 'Which evidence type is generally strongest?', options: ['A) Anecdotal', 'B) Empirical', 'C) Hypothetical', 'D) Personal opinion'], correctAnswer: 'B', explanation: 'Empirical evidence is based on observation and data.' },
          { question: 'Why address counterarguments?', options: ['A) To weaken your position', 'B) To show you considered multiple perspectives', 'C) To confuse the reader', 'D) It is not necessary'], correctAnswer: 'B', explanation: 'Addressing counterarguments strengthens your argument.' },
          { question: 'How do you evaluate evidence quality?', options: ['A) Check if it is long', 'B) Check source reliability and relevance', 'C) Count the number of quotes', 'D) See if it agrees with you'], correctAnswer: 'B', explanation: 'Quality depends on the source and its relevance to the claim.' },
        ],
      },
    },
  });
  console.log('Sample lesson:', sampleLesson.title);

  const mathLesson = await prisma.lesson.upsert({
    where: { id: 'demo_lesson_math_001' },
    update: {
      classId: demoClass.id,
      standard: 'Compare fractions with unlike denominators using visual models and benchmark fractions.',
      title: 'Fractions on a Number Line',
      status: 'READY',
      publishedAt: new Date(),
      publishedById: teacher.id,
      foundational: {
        levelLabel: 'Foundational',
        lexileRange: '350L-500L',
        overview: 'Learn how to compare fractions by seeing where they belong on a number line.',
        keyVocabulary: [
          { term: 'fraction', definition: 'A number that shows equal parts of a whole.' },
          { term: 'benchmark fraction', definition: 'A familiar fraction like 1/2 that helps you compare.' },
        ],
        mainContent:
          'Fractions can be compared by placing them on a number line. If one fraction lands farther to the right, it is greater. Benchmark fractions like 1/2 help you decide if a fraction is smaller or larger.',
        activities: [
          { title: 'Number Line Match', instructions: 'Place 1/4, 1/2, and 3/4 on a blank number line and explain which is greatest.', estimatedMinutes: 10 },
        ],
        quiz: [
          { question: 'Which fraction is greater: 1/4 or 3/4?', options: ['A) 1/4', 'B) 3/4', 'C) They are equal', 'D) Not enough information'], correctAnswer: 'B', explanation: '3/4 is farther to the right on the number line.' },
          { question: 'What is a benchmark fraction?', options: ['A) A random fraction', 'B) A familiar fraction used for comparison', 'C) The biggest fraction', 'D) A fraction with 10 as the denominator'], correctAnswer: 'B', explanation: 'Benchmark fractions like 1/2 help compare other fractions.' },
        ],
      },
      gradeLevel: {
        levelLabel: 'Grade Level',
        lexileRange: '650L-850L',
        overview: 'Students compare fractions with unlike denominators by reasoning with size, benchmarks, and visual models.',
        keyVocabulary: [
          { term: 'numerator', definition: 'The top number in a fraction that tells how many parts are considered.' },
          { term: 'denominator', definition: 'The bottom number in a fraction that tells how many equal parts make the whole.' },
        ],
        mainContent:
          'Fractions with unlike denominators can still be compared without always finding common denominators first. Visual models and number lines reveal relative size, and benchmark fractions like 0, 1/2, and 1 help students justify their reasoning.',
        activities: [
          { title: 'Benchmark Sort', instructions: 'Sort 2/5, 5/8, 7/8, and 3/10 by whether they are less than, equal to, or greater than 1/2.', estimatedMinutes: 15 },
        ],
        quiz: [
          { question: 'Why is 5/8 greater than 1/2?', options: ['A) 8 is bigger than 2', 'B) 5/8 is to the right of 1/2 on the number line', 'C) Because it has more digits', 'D) It is not greater'], correctAnswer: 'B', explanation: '5/8 is greater than 4/8, which equals 1/2.' },
          { question: 'Which helps compare fractions quickly?', options: ['A) Benchmark fractions', 'B) Guessing', 'C) Ignoring denominators', 'D) Only using decimals'], correctAnswer: 'A', explanation: 'Benchmarks give a reference point for comparison.' },
        ],
      },
      advanced: {
        levelLabel: 'Advanced',
        lexileRange: '950L-1150L',
        overview: 'Students justify fraction comparisons using benchmark reasoning, equivalence, and precision in mathematical argument.',
        keyVocabulary: [
          { term: 'equivalent fractions', definition: 'Different fractions that represent the same value.' },
          { term: 'justify', definition: 'To explain reasoning with evidence and precise math language.' },
        ],
        mainContent:
          'Advanced fraction comparison requires more than identifying the larger number. Students must justify whether fractions are greater than or less than benchmarks, determine equivalence when useful, and communicate why a comparison remains true across different representations.',
        activities: [
          { title: 'Defend the Comparison', instructions: 'Write a short argument explaining whether 7/12 or 5/8 is greater, using a benchmark or equivalent fractions.', estimatedMinutes: 20 },
        ],
        quiz: [
          { question: 'Which is the strongest justification?', options: ['A) 7 is greater than 5', 'B) 5/8 = 0.625 and 7/12 is about 0.583', 'C) I have seen 5/8 before', 'D) 12 is larger than 8'], correctAnswer: 'B', explanation: 'The comparison is justified with equivalent numeric reasoning.' },
          { question: 'Why use a benchmark fraction?', options: ['A) To avoid thinking', 'B) To create a known reference point', 'C) To make denominators disappear', 'D) To always get an exact answer'], correctAnswer: 'B', explanation: 'Benchmarks make reasoning easier and more precise.' },
        ],
      },
    },
    create: {
      id: 'demo_lesson_math_001',
      classId: demoClass.id,
      standard: 'Compare fractions with unlike denominators using visual models and benchmark fractions.',
      title: 'Fractions on a Number Line',
      status: 'READY',
      publishedAt: new Date(),
      publishedById: teacher.id,
      foundational: {
        levelLabel: 'Foundational',
        lexileRange: '350L-500L',
        overview: 'Learn how to compare fractions by seeing where they belong on a number line.',
        keyVocabulary: [
          { term: 'fraction', definition: 'A number that shows equal parts of a whole.' },
          { term: 'benchmark fraction', definition: 'A familiar fraction like 1/2 that helps you compare.' },
        ],
        mainContent:
          'Fractions can be compared by placing them on a number line. If one fraction lands farther to the right, it is greater. Benchmark fractions like 1/2 help you decide if a fraction is smaller or larger.',
        activities: [
          { title: 'Number Line Match', instructions: 'Place 1/4, 1/2, and 3/4 on a blank number line and explain which is greatest.', estimatedMinutes: 10 },
        ],
        quiz: [
          { question: 'Which fraction is greater: 1/4 or 3/4?', options: ['A) 1/4', 'B) 3/4', 'C) They are equal', 'D) Not enough information'], correctAnswer: 'B', explanation: '3/4 is farther to the right on the number line.' },
          { question: 'What is a benchmark fraction?', options: ['A) A random fraction', 'B) A familiar fraction used for comparison', 'C) The biggest fraction', 'D) A fraction with 10 as the denominator'], correctAnswer: 'B', explanation: 'Benchmark fractions like 1/2 help compare other fractions.' },
        ],
      },
      gradeLevel: {
        levelLabel: 'Grade Level',
        lexileRange: '650L-850L',
        overview: 'Students compare fractions with unlike denominators by reasoning with size, benchmarks, and visual models.',
        keyVocabulary: [
          { term: 'numerator', definition: 'The top number in a fraction that tells how many parts are considered.' },
          { term: 'denominator', definition: 'The bottom number in a fraction that tells how many equal parts make the whole.' },
        ],
        mainContent:
          'Fractions with unlike denominators can still be compared without always finding common denominators first. Visual models and number lines reveal relative size, and benchmark fractions like 0, 1/2, and 1 help students justify their reasoning.',
        activities: [
          { title: 'Benchmark Sort', instructions: 'Sort 2/5, 5/8, 7/8, and 3/10 by whether they are less than, equal to, or greater than 1/2.', estimatedMinutes: 15 },
        ],
        quiz: [
          { question: 'Why is 5/8 greater than 1/2?', options: ['A) 8 is bigger than 2', 'B) 5/8 is to the right of 1/2 on the number line', 'C) Because it has more digits', 'D) It is not greater'], correctAnswer: 'B', explanation: '5/8 is greater than 4/8, which equals 1/2.' },
          { question: 'Which helps compare fractions quickly?', options: ['A) Benchmark fractions', 'B) Guessing', 'C) Ignoring denominators', 'D) Only using decimals'], correctAnswer: 'A', explanation: 'Benchmarks give a reference point for comparison.' },
        ],
      },
      advanced: {
        levelLabel: 'Advanced',
        lexileRange: '950L-1150L',
        overview: 'Students justify fraction comparisons using benchmark reasoning, equivalence, and precision in mathematical argument.',
        keyVocabulary: [
          { term: 'equivalent fractions', definition: 'Different fractions that represent the same value.' },
          { term: 'justify', definition: 'To explain reasoning with evidence and precise math language.' },
        ],
        mainContent:
          'Advanced fraction comparison requires more than identifying the larger number. Students must justify whether fractions are greater than or less than benchmarks, determine equivalence when useful, and communicate why a comparison remains true across different representations.',
        activities: [
          { title: 'Defend the Comparison', instructions: 'Write a short argument explaining whether 7/12 or 5/8 is greater, using a benchmark or equivalent fractions.', estimatedMinutes: 20 },
        ],
        quiz: [
          { question: 'Which is the strongest justification?', options: ['A) 7 is greater than 5', 'B) 5/8 = 0.625 and 7/12 is about 0.583', 'C) I have seen 5/8 before', 'D) 12 is larger than 8'], correctAnswer: 'B', explanation: 'The comparison is justified with equivalent numeric reasoning.' },
          { question: 'Why use a benchmark fraction?', options: ['A) To avoid thinking', 'B) To create a known reference point', 'C) To make denominators disappear', 'D) To always get an exact answer'], correctAnswer: 'B', explanation: 'Benchmarks make reasoning easier and more precise.' },
        ],
      },
    },
  });
  console.log('Math lesson:', mathLesson.title);

  console.log('\n--- Seed complete ---');
  console.log('Teacher ID:  demo_teacher_001');
  console.log('Student ID:  demo_student_001');
  console.log('Class ID:   ', demoClass.id);
  console.log('Join Code:   DEMO2024');
  console.log('Lesson ID:   demo_lesson_001');
  console.log('Math ID:     demo_lesson_math_001');
  console.log('\nYou can now test all routes without Claude API credits.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
