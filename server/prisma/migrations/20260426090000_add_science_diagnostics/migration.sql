ALTER TYPE "DiagnosticDomain" ADD VALUE IF NOT EXISTS 'SCIENCE';

ALTER TABLE "LearnerProfile"
ADD COLUMN IF NOT EXISTS "diagnosticScienceLevel" "ReadingLevel";
