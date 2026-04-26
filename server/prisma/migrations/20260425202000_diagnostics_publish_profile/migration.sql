-- CreateEnum
CREATE TYPE "MathLevel" AS ENUM ('BELOW_GRADE', 'GRADE_LEVEL', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('MIXED_MEDIA', 'TEXT_FOCUSED', 'AUDIO_FOCUSED');

-- CreateEnum
CREATE TYPE "DiagnosticDomain" AS ENUM ('READING', 'MATH');

-- CreateEnum
CREATE TYPE "DiagnosticStatus" AS ENUM ('COMPLETED', 'REVIEWED');

-- AlterTable
ALTER TABLE "Lesson"
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publishedById" TEXT;

-- AlterTable
ALTER TABLE "LearnerProfile"
ADD COLUMN "diagnosticReadingLevel" "ReadingLevel",
ADD COLUMN "gradeLevelLabel" TEXT,
ADD COLUMN "readingLexile" INTEGER,
ADD COLUMN "mathLevel" "MathLevel" NOT NULL DEFAULT 'GRADE_LEVEL',
ADD COLUMN "diagnosticMathLevel" "MathLevel",
ADD COLUMN "screenReaderMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "preferredContentFormat" "ContentFormat" NOT NULL DEFAULT 'MIXED_MEDIA',
ADD COLUMN "supportFlags" JSONB,
ADD COLUMN "recommendedProfilePatch" JSONB;

-- CreateTable
CREATE TABLE "DiagnosticAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "domain" "DiagnosticDomain" NOT NULL,
    "status" "DiagnosticStatus" NOT NULL DEFAULT 'COMPLETED',
    "questionSetKey" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "inferredReadingLevel" "ReadingLevel",
    "inferredMathLevel" "MathLevel",
    "recommendedProfilePatch" JSONB,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosticAttempt_userId_idx" ON "DiagnosticAttempt"("userId");

-- CreateIndex
CREATE INDEX "DiagnosticAttempt_classId_idx" ON "DiagnosticAttempt"("classId");

-- CreateIndex
CREATE INDEX "DiagnosticAttempt_domain_idx" ON "DiagnosticAttempt"("domain");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAttempt" ADD CONSTRAINT "DiagnosticAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAttempt" ADD CONSTRAINT "DiagnosticAttempt_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
