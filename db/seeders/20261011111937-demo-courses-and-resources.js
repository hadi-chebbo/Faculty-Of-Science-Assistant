'use strict';

// DEVELOPMENT ONLY. All data is obviously fake; the real course list is loaded in a later phase.
// Runs only when SEED_DEMO_DATA=true.

/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');
const { pathToFileURL } = require('node:url');
/* eslint-enable @typescript-eslint/no-require-imports */

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

// Four "full" courses, one per semester, at about the volume of a real semester. They are generated
// from a fixed description (no randomness, no clock), so every run produces identical rows.
// Chapter 6 is left empty on purpose.
const FULL_COURSES = [
  { code: 'DEMO310', title: 'Sample Full Course A', semester: 3, years: [2022, 2023, 2024, 2025] },
  { code: 'DEMO410', title: 'Sample Full Course B', semester: 4, years: [2022, 2023, 2024, 2025] },
  { code: 'DEMO510', title: 'Sample Full Course C', semester: 5, years: [2022, 2023, 2024] },
  { code: 'DEMO610', title: 'Sample Full Course D', semester: 6, years: [2022, 2023, 2024] },
];
const FULL_CHAPTER_TITLES = [1, 2, 3, 4, 5, 6].map((n) => `Sample chapter ${n}`);
const SESSIONS = ['partial', 'final', 'second'];

function buildFullCourse({ code, years }, c) {
  const lower = code.toLowerCase();
  let i = 0; // Running index that drives the language and description variation.
  const base = (type, title, path, extra = {}) => ({
    course: code,
    type,
    title,
    path: `${lower}/${path}`,
    ...(i % 7 === 3 ? { language: 'fr' } : {}),
    ...(i++ % 6 === 1 ? { description: `Sample description of ${title.toLowerCase()}.` } : {}),
    ...extra,
  });
  const resources = [];
  const solutions = [];

  for (let n = 1; n <= 5; n++) {
    const lectures = 2 + ((n + c) % 2);
    const sheets = 1 + ((n + c) % 3 === 0 ? 1 : 0);
    for (let k = 1; k <= lectures; k++) {
      resources.push(base('lecture', `Sample lecture ${n}.${k}`, `lecture-${n}-${k}`, { chapter: n }));
    }
    resources.push(base('notes', `Sample notes ${n}`, `notes-${n}`, { chapter: n }));
    for (let k = 1; k <= sheets; k++) {
      const title = `Sample exercise sheet ${n}.${k}`;
      resources.push(base('exercise', title, `exercise-${n}-${k}`, { chapter: n, key: `${code} ${title}` }));
      const unsolved = (n === 3 && k === 1) || (n * k + c) % 4 === 0;
      if (!unsolved) {
        solutions.push(base('solution', `${title} solution`, `exercise-${n}-${k}-solution`, { chapter: n, of: `${code} ${title}` }));
      }
    }
  }

  // Previous exams: every year x session except a few combinations, with about half solved.
  let j = 0;
  for (const year of years) {
    for (const session of SESSIONS) {
      if ((j + c) % 5 !== 4) {
        const title = session === 'second' ? `Sample second session exam ${year}` : `Sample ${session} exam ${year}`;
        resources.push(base('exam', title, `${session}-${year}`, { session, year, key: `${code} ${title}` }));
        if (j % 2 === 0) {
          solutions.push(base('solution', `${title} solution`, `${session}-${year}-solution`, { of: `${code} ${title}` }));
        }
      }
      j++;
    }
  }

  // Material outside chapters, an unlinked solution and two drafts.
  resources.push(
    base('other', 'Sample syllabus', 'syllabus'),
    base('other', 'Sample reference sheet', 'reference'),
    base('notes', 'Sample general notes', 'general-notes'),
    base('solution', 'Sample extra solution', 'extra-solution'),
    base('lecture', 'Sample draft lecture', 'draft-lecture', { chapter: 2, draft: true }),
    base('notes', 'Sample draft with no source', 'draft', { draft: true, noSource: true }),
  );
  return { resources, solutions };
}

FULL_COURSES.forEach((course, c) => {
  const { resources, solutions } = buildFullCourse(course, c);
  COURSES.push({ code: course.code, title: course.title, semester: course.semester });
  RESOURCES.push(...resources);
  SOLUTIONS.push(...solutions);
});

// Chapters per course, and every resource that sits in one (the lists above plus the full courses).
const CHAPTERS = new Map([
  ...CHAPTER_COURSES.map((code) => [code, CHAPTER_TITLES]),
  ...FULL_COURSES.map(({ code }) => [code, FULL_CHAPTER_TITLES]),
]);
const IN_CHAPTER = [...CHAPTER_OF, ...[...RESOURCES, ...SOLUTIONS].filter((r) => r.chapter)];

async function deleteDemoData(queryInterface, transaction) {
  const { sequelize } = queryInterface;
  // Resources first (the course foreign key restricts deletion); this cascades bookmarks and completions.
  await sequelize.query(
    "DELETE FROM resources WHERE course_id IN (SELECT id FROM courses WHERE code LIKE 'DEMO%')",
    { transaction },
  );
  await sequelize.query("DELETE FROM courses WHERE code LIKE 'DEMO%'", { transaction });
}

// Everything about the stored files goes through the app's own storage driver (local folder, or R2
// when STORAGE_DRIVER=r2). The storage code is TypeScript, so a small helper loads it.
async function loadStorage() {
  const helper = pathToFileURL(path.join(__dirname, 'lib', 'storage.mjs')).href;
  return (await import(helper)).loadStorage();
}

const TYPE_LABELS = {
  lecture: 'Lecture',
  notes: 'Notes',
  exercise: 'Exercise',
  exam: 'Exam',
  solution: 'Solution',
  other: 'Other',
};
const SESSION_LABELS = { partial: 'partial', final: 'final', second: 'second session' };

function pdfLines(r, courseTitles) {
  const type = r.solutionOf ? 'solution' : r.type;
  const details = [TYPE_LABELS[type]];
  if (type === 'exam' && r.session) details.push(SESSION_LABELS[r.session]);
  if (r.year) details.push(String(r.year));
  return [
    'SAMPLE FILE',
    r.title,
    `${r.course} - ${courseTitles.get(r.course)}`,
    details.join(', '),
    'Placeholder for development. Not university material.',
  ];
}

// How many files are sent to storage at once. One at a time, about 220 round trips to R2 took minutes.
const UPLOADS_AT_ONCE = 8;

// Deletes stored files, never failing the seed over one: a failure leaves an orphan, which is
// reported by count (never by key).
async function deleteFiles(storage, keys, when) {
  const results = await Promise.allSettled(keys.map((key) => storage.delete(key)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) console.warn(`demo-courses-and-resources: ${failed} stored file(s) could not be deleted ${when}`);
}

// Stores one placeholder PDF per resource that has a source and returns the keys by resource object.
// If storing fails part way, the files already stored are removed again.
async function storeFiles(resources, courseTitles) {
  const { getStorage, newResourceFileKey, samplePdf, contentType } = await loadStorage();
  const storage = getStorage();
  const keys = new Map();
  const queue = resources.filter((r) => !r.noSource);
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const key = newResourceFileKey();
      keys.set(r, key); // Recorded first, so a failed put is cleaned up too.
      await storage.put(key, samplePdf(pdfLines(r, courseTitles)), contentType);
    }
  };
  try {
    await Promise.all(Array.from({ length: UPLOADS_AT_ONCE }, worker));
  } catch (error) {
    queue.length = 0; // Stop the other workers taking more.
    await deleteFiles(storage, [...keys.values()], 'after a failed upload');
    throw error;
  }
  return { keys, storage };
}

async function demoFileKeys(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    "SELECT file_key FROM resources WHERE file_key IS NOT NULL AND course_id IN (SELECT id FROM courses WHERE code LIKE 'DEMO%')",
    { transaction },
  );
  return rows.map((row) => row.file_key);
}

function toRow(r, courseIds, now, solutionOfId, fileKey) {
  const published = !r.draft;
  return {
    course_id: courseIds.get(r.course),
    type: r.solutionOf ? 'solution' : r.type,
    title: r.title,
    description: r.description ?? null,
    academic_year_start: r.year ?? null,
    exam_session: r.session ?? null,
    language: r.language ?? 'en',
    file_key: fileKey ?? null,
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

    // Files first, then the rows that point at them. If the insert fails, the files are removed.
    const courseTitles = new Map(COURSES.map((c) => [c.code, c.title]));
    // Solutions as resources, built once and used both for their files and for their rows.
    const solutionResources = new Map(SOLUTIONS.map((s) => [s, { ...s, type: 'solution', solutionOf: true }]));
    const { keys, storage } = await storeFiles([...RESOURCES, ...solutionResources.values()], courseTitles);

    // The previous demo files are removed once the new rows are committed (below).
    let previousKeys = [];
    try {
      await queryInterface.sequelize.transaction(async (transaction) => {
        const now = new Date();
        previousKeys = await demoFileKeys(queryInterface, transaction);
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
          RESOURCES.map((r) => toRow(r, courseIds, now, undefined, keys.get(r))),
          { transaction },
        );

        // Look up the ids of the resources that solutions point at.
        const loadResourceRows = async () =>
          (
            await queryInterface.sequelize.query(
              'SELECT id, course_id, title FROM resources WHERE course_id IN (:ids)',
              { transaction, replacements: { ids: [...courseIds.values()] } },
            )
          )[0];
        let resourceRows = await loadResourceRows();
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
            const r = solutionResources.get(s);
            return toRow(r, courseIds, now, solutionOfId, keys.get(r));
          }),
          { transaction },
        );

        resourceRows = await loadResourceRows(); // Now including the solutions.

        // Chapters. The demo data is deleted and re-created above, so this is safe to run again
        // on a database that already has the demo courses and resources.
        await queryInterface.bulkInsert(
          'chapters',
          [...CHAPTERS].flatMap(([code, titles]) =>
            titles.map((title, i) => ({
              course_id: courseIds.get(code),
              position: i + 1,
              title,
              created_at: now,
              updated_at: now,
            })),
          ),
          { transaction },
        );

        for (const { course, title, chapter } of IN_CHAPTER) {
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
    } catch (error) {
      await deleteFiles(storage, [...keys.values()], 'after a failed insert');
      throw error;
    }
    await deleteFiles(storage, previousKeys, 'from the previous seed');
  },

  async down(queryInterface) {
    let keys = [];
    await queryInterface.sequelize.transaction(async (transaction) => {
      keys = await demoFileKeys(queryInterface, transaction);
      await deleteDemoData(queryInterface, transaction);
    });
    // Remove the stored files once the rows are gone (a missing object is fine).
    if (keys.length > 0) {
      const { getStorage } = await loadStorage();
      await deleteFiles(getStorage(), keys, 'on undo');
    }
  },
};
