-- CreateEnum
CREATE TYPE "LessonSection" AS ENUM ('TITLE', 'OVERVIEW', 'MAIN_CONTENT', 'KEY_VOCABULARY', 'ACTIVITIES', 'QUIZ');

-- CreateEnum
CREATE TYPE "LessonEditType" AS ENUM ('ACCEPTED_AS_IS', 'MODIFIED', 'REJECTED', 'REGENERATED');

-- CreateTable
CREATE TABLE "LessonEdit" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "level" "ReadingLevel" NOT NULL,
    "section" "LessonSection" NOT NULL,
    "editType" "LessonEditType" NOT NULL,
    "aiVersion" JSONB NOT NULL,
    "humanVersion" JSONB,
    "charDelta" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonEdit_lessonId_idx" ON "LessonEdit"("lessonId");

-- CreateIndex
CREATE INDEX "LessonEdit_teacherId_idx" ON "LessonEdit"("teacherId");

-- CreateIndex
CREATE INDEX "LessonEdit_section_editType_idx" ON "LessonEdit"("section", "editType");

-- AddForeignKey
ALTER TABLE "LessonEdit" ADD CONSTRAINT "LessonEdit_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonEdit" ADD CONSTRAINT "LessonEdit_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
