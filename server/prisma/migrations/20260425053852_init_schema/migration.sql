-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER', 'STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('GENERATING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReadingLevel" AS ENUM ('FOUNDATIONAL', 'GRADE_LEVEL', 'ADVANCED');

-- CreateEnum
CREATE TYPE "BandwidthMode" AS ENUM ('FULL', 'REDUCED', 'TEXT_ONLY');

-- CreateEnum
CREATE TYPE "FontSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XLARGE');

-- CreateEnum
CREATE TYPE "TtsProvider" AS ENUM ('ELEVENLABS', 'WEB_SPEECH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'GENERATING',
    "foundational" JSONB,
    "gradeLevel" JSONB,
    "advanced" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readingLevel" "ReadingLevel" NOT NULL DEFAULT 'GRADE_LEVEL',
    "language" TEXT NOT NULL DEFAULT 'en',
    "bandwidthMode" "BandwidthMode" NOT NULL DEFAULT 'FULL',
    "fontSize" "FontSize" NOT NULL DEFAULT 'MEDIUM',
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "dyslexiaFont" BOOLEAN NOT NULL DEFAULT false,
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ttsProvider" "TtsProvider" NOT NULL DEFAULT 'WEB_SPEECH',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioCache" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "ReadingLevel" NOT NULL,
    "language" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationCache" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "level" "ReadingLevel" NOT NULL,
    "targetLang" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Class_joinCode_key" ON "Class"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_classId_key" ON "Enrollment"("userId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerProfile_userId_key" ON "LearnerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AudioCache_lessonId_level_language_key" ON "AudioCache"("lessonId", "level", "language");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationCache_lessonId_level_targetLang_key" ON "TranslationCache"("lessonId", "level", "targetLang");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerProfile" ADD CONSTRAINT "LearnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioCache" ADD CONSTRAINT "AudioCache_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioCache" ADD CONSTRAINT "AudioCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationCache" ADD CONSTRAINT "TranslationCache_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
