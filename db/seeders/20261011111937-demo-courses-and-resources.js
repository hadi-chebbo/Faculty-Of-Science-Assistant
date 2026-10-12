'use strict';

// DEVELOPMENT ONLY. All data is obviously fake; the real course list is loaded in a later phase.
// Runs only when SEED_DEMO_DATA=true.

const SKIP_MESSAGE = 'demo-courses-and-resources: skipped (SEED_DEMO_DATA is not "true")';

const COURSES = [
  { code: 'DEMO301', title: 'Sample Course A', semester: 3 },
  { code: 'DEMO302', title: 'Sample Course B', semester: 3 },
  { code: 'DEMO401', title: 'Sample Course C', semester: 4 },
  { code: 'DEMO402', title: 'Sample Course D', semester: 4 },
  { code: 'DEMO501', title: 'Sample Course E', semester: 5 },
  { code: 'DEMO502', title: 'Sample Course F', semester: 5 },
  { code: 'DEMO601', title: 'Sample Course G', semester: 6 },
  // DEMO602 deliberately has no resources (empty state).
  { code: 'DEMO602', title: 'Sample Course H', semester: 6 },
];

const url = (path) => `https://example.com/demo/${path}`;

// Base resources (published unless `draft`). `key` lets solutions refer to them.
const RESOURCES = [
  // DEMO301
  { course: 'DEMO301', type: 'lecture', title: 'Sample lecture 1', description: 'Sample introduction slides.', path: 'demo301/lecture-1' },
  { course: 'DEMO301', type: 'lecture', title: 'Sample lecture 2', path: 'demo301/lecture-2', language: 'fr' },
  { course: 'DEMO301', type: 'notes', title: 'Sample notes', description: 'Sample summary notes.', path: 'demo301/notes' },
  { course: 'DEMO301', type: 'exercise', key: 'ex301', title: 'Sample exercise sheet 1', year: 2024, path: 'demo301/exercise-1' },
  { course: 'DEMO301', type: 'exam', key: 'exam301', title: 'Sample partial exam 2023', session: 'partial', year: 2023, path: 'demo301/partial-2023' },
  { course: 'DEMO301', type: 'exam', title: 'Sample final exam 2022', session: 'final', year: 2022, language: 'fr', path: 'demo301/final-2022' },
  // DEMO302
  { course: 'DEMO302', type: 'lecture', title: 'Sample lecture 1', path: 'demo302/lecture-1' },
  { course: 'DEMO302', type: 'exercise', key: 'ex302', title: 'Sample exercise sheet 1', description: 'Sample practice problems.', year: 2025, path: 'demo302/exercise-1' },
  { course: 'DEMO302', type: 'exam', title: 'Sample second session exam 2024', session: 'second', year: 2024, path: 'demo302/second-2024' },
  { course: 'DEMO302', type: 'other', title: 'Sample reference sheet', path: 'demo302/reference' },
  // DEMO401
  { course: 'DEMO401', type: 'lecture', title: 'Sample lecture 1', path: 'demo401/lecture-1' },
  { course: 'DEMO401', type: 'notes', title: 'Sample notes', language: 'fr', path: 'demo401/notes' },
  { course: 'DEMO401', type: 'exam', key: 'exam401', title: 'Sample final exam 2024', session: 'final', year: 2024, path: 'demo401/final-2024' },
  { course: 'DEMO401', type: 'exam', title: 'Sample partial exam 2025', session: 'partial', year: 2025, description: 'Sample partial exam.', path: 'demo401/partial-2025' },
  // DEMO402
  { course: 'DEMO402', type: 'lecture', title: 'Sample lecture 1', path: 'demo402/lecture-1' },
  { course: 'DEMO402', type: 'exercise', title: 'Sample exercise sheet 1', year: 2023, path: 'demo402/exercise-1' },
  { course: 'DEMO402', type: 'exam', title: 'Sample partial exam 2022', session: 'partial', year: 2022, path: 'demo402/partial-2022' },
  { course: 'DEMO402', type: 'other', title: 'Sample lab guide', description: 'Sample lab instructions.', path: 'demo402/lab-guide' },
  // DEMO501
  { course: 'DEMO501', type: 'lecture', title: 'Sample lecture 1', path: 'demo501/lecture-1' },
  { course: 'DEMO501', type: 'lecture', title: 'Sample lecture 2', path: 'demo501/lecture-2' },
  { course: 'DEMO501', type: 'notes', title: 'Sample notes', path: 'demo501/notes' },
  { course: 'DEMO501', type: 'exam', key: 'exam501', title: 'Sample final exam 2025', session: 'final', year: 2025, language: 'fr', path: 'demo501/final-2025' },
  { course: 'DEMO501', type: 'exam', title: 'Sample second session exam 2023', session: 'second', year: 2023, path: 'demo501/second-2023' },
  // DEMO502
  { course: 'DEMO502', type: 'lecture', title: 'Sample lecture 1', path: 'demo502/lecture-1' },
  { course: 'DEMO502', type: 'exercise', title: 'Sample exercise sheet 1', year: 2025, path: 'demo502/exercise-1' },
  { course: 'DEMO502', type: 'exam', title: 'Sample partial exam 2024', session: 'partial', year: 2024, path: 'demo502/partial-2024' },
  // DEMO601
  { course: 'DEMO601', type: 'lecture', title: 'Sample lecture 1', path: 'demo601/lecture-1' },
  { course: 'DEMO601', type: 'notes', title: 'Sample notes', description: 'Sample notes for revision.', path: 'demo601/notes' },
  { course: 'DEMO601', type: 'other', title: 'Sample project brief', language: 'fr', path: 'demo601/project-brief' },
  // Unpublished drafts
  { course: 'DEMO501', type: 'lecture', title: 'Sample draft lecture', description: 'Draft with an external link.', path: 'demo501/draft-lecture', draft: true },
  { course: 'DEMO601', type: 'notes', title: 'Sample draft notes with no source', draft: true, noSource: true },
];

// Solutions, each linked to an exam or exercise of the same course.
const SOLUTIONS = [
  { course: 'DEMO301', of: 'exam301', title: 'Sample partial exam 2023 solution', path: 'demo301/partial-2023-solution' },
  { course: 'DEMO301', of: 'ex301', title: 'Sample exercise sheet 1 solution', description: 'Sample worked solution.', path: 'demo301/exercise-1-solution' },
  { course: 'DEMO302', of: 'ex302', title: 'Sample exercise sheet 1 solution', path: 'demo302/exercise-1-solution', language: 'fr' },
  { course: 'DEMO401', of: 'exam401', title: 'Sample final exam 2024 solution', path: 'demo401/final-2024-solution' },
  { course: 'DEMO501', of: 'exam501', title: 'Sample final exam 2025 solution', path: 'demo501/final-2025-solution', draft: true },
];

// Chapters for three courses, and which non-exam resources sit in them. Everything else (including
// exams, solutions and the rest of each course) stays under "General".
const CHAPTER_COURSES = ['DEMO301', 'DEMO302', 'DEMO501'];
const CHAPTER_TITLES = ['Sample chapter 1', 'Sample chapter 2', 'Sample chapter 3'];
const CHAPTER_OF = [
  { course: 'DEMO301', title: 'Sample lecture 1', chapter: 1 },
  { course: 'DEMO301', title: 'Sample lecture 2', chapter: 2 },
  { course: 'DEMO301', title: 'Sample notes', chapter: 3 },
  { course: 'DEMO302', title: 'Sample lecture 1', chapter: 1 },
  // An exercise sheet in a chapter, beside the lecture; its solution stays a link on its row.
  { course: 'DEMO302', title: 'Sample exercise sheet 1', chapter: 1 },
  { course: 'DEMO501', title: 'Sample lecture 1', chapter: 1 },
  { course: 'DEMO501', title: 'Sample lecture 2', chapter: 2 },
];

async function deleteDemoData(queryInterface, transaction) {
  const { sequelize } = queryInterface;
  // Resources first (the course foreign key restricts deletion); this cascades bookmarks and completions.
  await sequelize.query(
    "DELETE FROM resources WHERE course_id IN (SELECT id FROM courses WHERE code LIKE 'DEMO%')",
    { transaction },
  );
  await sequelize.query("DELETE FROM courses WHERE code LIKE 'DEMO%'", { transaction });
}

function toRow(r, courseIds, now, solutionOfId) {
  const published = !r.draft;
  return {
    course_id: courseIds.get(r.course),
    type: r.solutionOf ? 'solution' : r.type,
    title: r.title,
    description: r.description ?? null,
    academic_year_start: r.year ?? null,
    exam_session: r.session ?? null,
    language: r.language ?? 'en',
    file_key: null,
    external_url: r.noSource ? null : url(r.path),
    solution_of_id: solutionOfId ?? null,
    is_published: published,
    created_at: now,
    updated_at: now,
  };
}

module.exports = {
  async up(queryInterface) {
    if (process.env.SEED_DEMO_DATA !== 'true') {
      console.log(SKIP_MESSAGE);
      return;
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      const now = new Date();
      await deleteDemoData(queryInterface, transaction);

      await queryInterface.bulkInsert(
        'courses',
        COURSES.map((c) => ({ ...c, created_at: now, updated_at: now })),
        { transaction },
      );

      const [courseRows] = await queryInterface.sequelize.query(
        "SELECT id, code FROM courses WHERE code LIKE 'DEMO%'",
        { transaction },
      );
      const courseIds = new Map(courseRows.map((row) => [row.code, row.id]));

      await queryInterface.bulkInsert(
        'resources',
        RESOURCES.map((r) => toRow(r, courseIds, now)),
        { transaction },
      );

      // Look up the ids of the resources that solutions point at.
      const [resourceRows] = await queryInterface.sequelize.query(
        'SELECT id, course_id, title FROM resources WHERE course_id IN (:ids)',
        { transaction, replacements: { ids: [...courseIds.values()] } },
      );
      const idFor = (courseCode, title) => {
        const row = resourceRows.find(
          (x) => x.course_id === courseIds.get(courseCode) && x.title === title,
        );
        if (!row) throw new Error(`demo seed: missing resource "${title}" in ${courseCode}`);
        return row.id;
      };
      const byKey = new Map(
        RESOURCES.filter((r) => r.key).map((r) => [r.key, idFor(r.course, r.title)]),
      );

      await queryInterface.bulkInsert(
        'resources',
        SOLUTIONS.map((s) => {
          const solutionOfId = byKey.get(s.of);
          return toRow({ ...s, type: 'solution', solutionOf: true }, courseIds, now, solutionOfId);
        }),
        { transaction },
      );

      // Chapters. The demo data is deleted and re-created above, so this is safe to run again
      // on a database that already has the demo courses and resources.
      await queryInterface.bulkInsert(
        'chapters',
        CHAPTER_COURSES.flatMap((code) =>
          CHAPTER_TITLES.map((title, i) => ({
            course_id: courseIds.get(code),
            position: i + 1,
            title,
            created_at: now,
            updated_at: now,
          })),
        ),
        { transaction },
      );

      for (const { course, title, chapter } of CHAPTER_OF) {
        await queryInterface.sequelize.query(
          'UPDATE resources SET chapter_id = (SELECT id FROM chapters WHERE course_id = :courseId AND position = :position) WHERE id = :resourceId',
          {
            transaction,
            replacements: {
              courseId: courseIds.get(course),
              position: chapter,
              resourceId: idFor(course, title),
            },
          },
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await deleteDemoData(queryInterface, transaction);
    });
  },
};
