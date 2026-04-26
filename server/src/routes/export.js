const express = require('express');
const PDFDocument = require('pdfkit');
const prisma = require('../lib/prisma');
const { protect, requireTeacher } = require('../middleware/auth');
const { assertLessonAccess } = require('../lib/lesson-access');
const { isHttpError } = require('../lib/http-error');
const router = express.Router();

// ─── GET /api/export/:lessonId/pdf ───────────────────────────────────────────
// Export a lesson as a formatted PDF download
router.get('/:lessonId/pdf', protect, requireTeacher, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { level } = req.query; // optional: foundational, gradeLevel, advanced

    const { lesson } = await assertLessonAccess({
      lessonId,
      userId: req.auth.userId,
      allowTeacherOwner: true,
      allowEnrolledStudent: false,
      requireReady: true,
    });

    // Log the export event
    await prisma.engagementEvent.create({
      data: {
        userId: req.auth.userId,
        lessonId,
        eventType: 'EXPORT_PDF',
        metadata: { level: level || 'all' },
      },
    }).catch(() => {});

    // Build the PDF
    const doc = new PDFDocument({ margin: 50 });
    const filename = `${lesson.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Title page
    doc.fontSize(24).font('Helvetica-Bold').text(lesson.title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Class: ${lesson.class.name}`, { align: 'center' });
    doc.fontSize(10).text(`Standard: ${lesson.standard}`, { align: 'center' });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
    doc.moveDown(1);

    // Determine which levels to include
    const levels = level
      ? [{ key: level, label: level.replace(/([A-Z])/g, ' $1').trim() }]
      : [
          { key: 'foundational', label: 'Foundational' },
          { key: 'gradeLevel', label: 'Grade Level' },
          { key: 'advanced', label: 'Advanced' },
        ];

    for (const { key, label } of levels) {
      const data = lesson[key];
      if (!data) continue;

      // Level header
      doc.fontSize(18).font('Helvetica-Bold').text(`${label} Level`, { underline: true });
      doc.moveDown(0.5);

      if (data.levelLabel) {
        doc.fontSize(14).font('Helvetica-Bold').text(data.levelLabel);
        doc.moveDown(0.3);
      }

      if (data.overview) {
        doc.fontSize(12).font('Helvetica-Bold').text('Overview:');
        doc.fontSize(11).font('Helvetica').text(data.overview, { lineGap: 2 });
        doc.moveDown(0.5);
      }

      if (data.keyVocabulary?.length) {
        doc.fontSize(12).font('Helvetica-Bold').text('Key Vocabulary:');
        data.keyVocabulary.forEach((entry) => {
          doc.fontSize(11).font('Helvetica').text(`  • ${entry.term}: ${entry.definition}`);
        });
        doc.moveDown(0.5);
      }

      // Reading passage
      if (data.mainContent) {
        doc.fontSize(12).font('Helvetica-Bold').text('Lesson Content:');
        doc.fontSize(11).font('Helvetica').text(data.mainContent, { lineGap: 2 });
        doc.moveDown(0.5);
      }

      if (data.activities?.length) {
        doc.fontSize(12).font('Helvetica-Bold').text('Activities:');
        data.activities.forEach((activity) => {
          doc.fontSize(11).font('Helvetica-Bold').text(`  • ${activity.title}`);
          doc.fontSize(10).font('Helvetica').text(`    ${activity.instructions}`);
        });
        doc.moveDown(0.5);
      }

      // Quiz
      if (data.quiz?.length) {
        doc.fontSize(12).font('Helvetica-Bold').text('Quiz:');
        data.quiz.forEach((q, i) => {
          doc.fontSize(11).font('Helvetica-Bold').text(`${i + 1}. ${q.question}`);
          if (q.options) {
            q.options.forEach((opt) => {
              doc.fontSize(10).font('Helvetica').text(`    ${opt}`);
            });
          }
          doc.fontSize(10).font('Helvetica-Oblique').text(`    Answer: ${q.correctAnswer || q.answer}`);
          doc.moveDown(0.2);
        });
        doc.moveDown(0.3);
      }

      // Discussion prompts
      if (data.discussionPrompts?.length || data.discussion_prompts?.length) {
        const prompts = data.discussionPrompts || data.discussion_prompts;
        doc.fontSize(12).font('Helvetica-Bold').text('Discussion Prompts:');
        prompts.forEach((p) => {
          doc.fontSize(11).font('Helvetica').text(`  • ${p}`);
        });
        doc.moveDown(0.5);
      }

      // Extension activities
      if (data.extensionActivities?.length || data.extension_activities?.length) {
        const extensions = data.extensionActivities || data.extension_activities;
        doc.fontSize(12).font('Helvetica-Bold').text('Extension Activities:');
        extensions.forEach((a) => {
          doc.fontSize(11).font('Helvetica').text(`  • ${a}`);
        });
        doc.moveDown(0.5);
      }

      // Separator between levels
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#eeeeee');
      doc.moveDown(0.5);
    }

    // Footer
    doc.fontSize(8).font('Helvetica').text(
      `Generated by EduForge on ${new Date().toLocaleDateString()}`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

    doc.end();
  } catch (err) {
    if (isHttpError(err) && !res.headersSent) {
      return res.status(err.status).json({ error: err.message });
    }
    // Only send JSON error if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
