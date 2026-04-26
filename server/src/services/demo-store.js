const { normalizeLessonPayload } = require('../lib/lesson-schema');

const TEACHER_ID = 'demo_teacher_001';
const STUDENT_ID = 'demo_student_001';

const state = {
  counters: { class: 1, lesson: 1, edit: 1 },
  classes: [],
  enrollments: [],
  lessons: [],
  profiles: new Map(),
  edits: [],
};

function isDemoStoreEnabled() {
  return !process.env.DATABASE_URL || process.env.USE_DEMO_STORE === 'true';
}

function now() {
  return new Date().toISOString();
}

function makeJoinCode(name, index) {
  const prefix = String(name || 'CLASS')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, 'X');
  return `${prefix}${String(index).padStart(2, '0')}`;
}

function defaultProfile(userId, updates = {}) {
  return {
    id: `demo-profile-${userId}`,
    userId,
    readingLevel: 'GRADE_LEVEL',
    diagnosticReadingLevel: null,
    gradeLevelLabel: null,
    readingLexile: null,
    mathLevel: 'GRADE_LEVEL',
    diagnosticMathLevel: null,
    language: 'en',
    bandwidthMode: 'FULL',
    fontSize: 'MEDIUM',
    highContrast: false,
    dyslexiaFont: false,
    screenReaderMode: false,
    reducedMotion: false,
    preferredContentFormat: 'MIXED_MEDIA',
    supportFlags: null,
    recommendedProfilePatch: null,
    ttsEnabled: false,
    ttsProvider: 'WEB_SPEECH',
    updatedAt: now(),
    ...updates,
  };
}

function getProfile(userId) {
  if (!state.profiles.has(userId)) {
    state.profiles.set(userId, defaultProfile(userId));
  }
  return state.profiles.get(userId);
}

function updateProfile(userId, updates) {
  const profile = defaultProfile(userId, { ...getProfile(userId), ...updates, updatedAt: now() });
  state.profiles.set(userId, profile);
  return profile;
}

function createClass({ name, teacherId = TEACHER_ID }) {
  const index = state.counters.class++;
  const classRecord = {
    id: `demo-class-${index}`,
    name: name.trim(),
    joinCode: makeJoinCode(name, index),
    teacherId,
    createdAt: now(),
  };
  state.classes.unshift(classRecord);
  return classRecord;
}

function listTeacherClasses(teacherId = TEACHER_ID) {
  return state.classes
    .filter((classRecord) => classRecord.teacherId === teacherId)
    .map((classRecord) => ({
      id: classRecord.id,
      name: classRecord.name,
      joinCode: classRecord.joinCode,
      studentCount: state.enrollments.filter((enrollment) => enrollment.classId === classRecord.id).length,
      lessonCount: state.lessons.filter((lesson) => lesson.classId === classRecord.id).length,
      createdAt: classRecord.createdAt,
    }));
}

function listStudentClasses(userId = STUDENT_ID) {
  return state.enrollments
    .filter((enrollment) => enrollment.userId === userId)
    .map((enrollment) => {
      const classRecord = state.classes.find((item) => item.id === enrollment.classId);
      if (!classRecord) return null;
      return {
        id: classRecord.id,
        name: classRecord.name,
        teacherEmail: 'teacher@demo.eduforge.app',
        lessonCount: state.lessons.filter((lesson) => lesson.classId === classRecord.id && lesson.publishedAt).length,
        joinedAt: enrollment.joinedAt,
      };
    })
    .filter(Boolean);
}

function joinClass({ joinCode, userId = STUDENT_ID }) {
  const classRecord = state.classes.find((item) => item.joinCode.toLowerCase() === String(joinCode).toLowerCase());
  if (!classRecord) return null;

  const existing = state.enrollments.find((item) => item.userId === userId && item.classId === classRecord.id);
  if (existing) {
    return { classRecord, enrollment: existing, alreadyEnrolled: true };
  }

  const enrollment = {
    id: `demo-enrollment-${userId}-${classRecord.id}`,
    userId,
    classId: classRecord.id,
    joinedAt: now(),
  };
  state.enrollments.push(enrollment);
  return { classRecord, enrollment, alreadyEnrolled: false };
}

function leaveClass({ classId, userId = STUDENT_ID }) {
  const before = state.enrollments.length;
  state.enrollments = state.enrollments.filter((item) => !(item.userId === userId && item.classId === classId));
  return before !== state.enrollments.length;
}

function getRoster({ classId, teacherId = TEACHER_ID }) {
  const classRecord = state.classes.find((item) => item.id === classId && item.teacherId === teacherId);
  if (!classRecord) return null;
  return {
    classId: classRecord.id,
    className: classRecord.name,
    joinCode: classRecord.joinCode,
    students: state.enrollments
      .filter((item) => item.classId === classRecord.id)
      .map((item) => ({
        id: item.userId,
        email: 'student@demo.eduforge.app',
        joinedAt: item.joinedAt,
      })),
  };
}

function deleteClass({ classId, teacherId = TEACHER_ID, force = false }) {
  const classRecord = state.classes.find((item) => item.id === classId && item.teacherId === teacherId);
  if (!classRecord) return { status: 'missing' };

  const lessonCount = state.lessons.filter((lesson) => lesson.classId === classId).length;
  if (lessonCount > 0 && !force) return { status: 'blocked', lessonCount };

  state.lessons = state.lessons.filter((lesson) => lesson.classId !== classId);
  state.enrollments = state.enrollments.filter((enrollment) => enrollment.classId !== classId);
  state.classes = state.classes.filter((item) => item.id !== classId);
  return { status: 'deleted', classId };
}

function saveLesson({ classId, className, title, standard, lesson, teacherId = TEACHER_ID }) {
  let targetClassId = classId;
  if (!targetClassId) {
    const draftName = className?.trim() || 'LessonForge Drafts';
    let draftClass = state.classes.find((item) => item.teacherId === teacherId && item.name === draftName);
    if (!draftClass) draftClass = createClass({ name: draftName, teacherId });
    targetClassId = draftClass.id;
  }

  const classRecord = state.classes.find((item) => item.id === targetClassId && item.teacherId === teacherId);
  if (!classRecord) return null;

  const normalized = normalizeLessonPayload({ ...lesson, title: title?.trim() || lesson.title, standard: standard.trim() });
  const createdAt = now();
  const saved = {
    id: `demo-lesson-${state.counters.lesson++}`,
    classId: classRecord.id,
    title: normalized.title,
    standard: standard.trim(),
    status: 'READY',
    publishedAt: null,
    publishedById: null,
    createdAt,
    updatedAt: createdAt,
    foundational: normalized.foundational,
    gradeLevel: normalized.gradeLevel,
    advanced: normalized.advanced,
    subject: normalized.subject,
    targetGrade: normalized.targetGrade,
    estimatedMinutes: normalized.estimatedMinutes,
  };
  state.lessons.unshift(saved);
  return saved;
}

function listLessonsForClass({ classId, userId, role }) {
  const classRecord = state.classes.find((item) => item.id === classId);
  if (!classRecord) return null;

  const isTeacher = role === 'TEACHER' && classRecord.teacherId === userId;
  const isStudent = state.enrollments.some((item) => item.userId === userId && item.classId === classId);
  if (!isTeacher && !isStudent) return false;

  return state.lessons
    .filter((lesson) => lesson.classId === classId && lesson.status === 'READY' && (isTeacher || lesson.publishedAt))
    .map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      standard: lesson.standard,
      status: lesson.status,
      publishedAt: lesson.publishedAt,
      createdAt: lesson.createdAt,
    }));
}

function getLesson({ lessonId, userId, role }) {
  const lesson = state.lessons.find((item) => item.id === lessonId);
  if (!lesson) return null;

  const classRecord = state.classes.find((item) => item.id === lesson.classId);
  const isTeacher = role === 'TEACHER' && classRecord?.teacherId === userId;
  const isStudent = role === 'STUDENT' && state.enrollments.some((item) => item.userId === userId && item.classId === lesson.classId);
  if (!isTeacher && !isStudent) return false;
  if (isStudent && !lesson.publishedAt) return false;

  return lesson;
}

function publishLesson({ lessonId, teacherId = TEACHER_ID }) {
  const lesson = getLesson({ lessonId, userId: teacherId, role: 'TEACHER' });
  if (!lesson) return lesson;
  lesson.publishedAt = now();
  lesson.publishedById = teacherId;
  return lesson;
}

function unpublishLesson({ lessonId, teacherId = TEACHER_ID }) {
  const lesson = getLesson({ lessonId, userId: teacherId, role: 'TEACHER' });
  if (!lesson) return lesson;
  lesson.publishedAt = null;
  lesson.publishedById = null;
  return lesson;
}

function deleteLesson({ lessonId, teacherId = TEACHER_ID }) {
  const lesson = getLesson({ lessonId, userId: teacherId, role: 'TEACHER' });
  if (!lesson) return false;
  state.lessons = state.lessons.filter((item) => item.id !== lessonId);
  state.edits = state.edits.filter((item) => item.lessonId !== lessonId);
  return true;
}

function recordEdit({ lessonId, teacherId = TEACHER_ID, level, section, editType, aiVersion, humanVersion, charDelta }) {
  const lesson = getLesson({ lessonId, userId: teacherId, role: 'TEACHER' });
  if (!lesson) return null;
  const edit = {
    id: `demo-edit-${state.counters.edit++}`,
    lessonId,
    teacherId,
    level,
    section,
    editType,
    aiVersion,
    humanVersion,
    charDelta,
    createdAt: now(),
  };
  state.edits.push(edit);
  return edit;
}

module.exports = {
  isDemoStoreEnabled,
  defaultProfile,
  getProfile,
  updateProfile,
  createClass,
  listTeacherClasses,
  listStudentClasses,
  joinClass,
  leaveClass,
  getRoster,
  deleteClass,
  saveLesson,
  listLessonsForClass,
  getLesson,
  publishLesson,
  unpublishLesson,
  deleteLesson,
  recordEdit,
};
