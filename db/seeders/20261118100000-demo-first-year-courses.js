'use strict';

// DEVELOPMENT ONLY. Two obviously fake first-year courses (semesters 1 and 2) with a few published
// files each, so the first-year pages have something to show. No chapters, bookmarks or completions.
// Runs only when SEED_DEMO_DATA=true, after the demo courses seeder.

/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');
const { pathToFileURL } = require('node:url');
/* eslint-enable @typescript-eslint/no-require-imports */

const SKIP_MESSAGE = 'demo-first-year-courses: skipped (SEED_DEMO_DATA is not "true")';

const COURSES = [
  { code: 'DEMO110', title: 'Sample Course First Year A', semester: 1 },
  { code: 'DEMO210', title: 'Sample Course First Year B', semester: 2 },
];
const CODES = COURSES.map((c) => c.code);

const url = (filePath) => `https://example.com/demo/${filePath}`;

// Published demo files have a stored file and a backup link, like the other demo courses.
const RESOURCES = COURSES.flatMap(({ code }) => {
  const lower = code.toLowerCase();
  return [
    { course: code, type: 'lecture', title: 'Sample lecture 1', description: 'Sample introduction slides.', path: `${lower}/lecture-1` },
    { course: code, type: 'notes', title: 'Sample notes', path: `${lower}/notes` },
    { course: code, type: 'exercise', title: 'Sample exercise sheet 1', year: 2024, path: `${lower}/exercise-1` },
    { course: code, type: 'exam', title: 'Sample partial exam 2023', session: 'partial', year: 2023, path: `${lower}/partial-2023` },
  ];
});

const TYPE_LABELS = { lecture: 'Lecture', notes: 'Notes', exercise: 'Exercise', exam: 'Exam' };
const SESSION_LABELS = { partial: 'partial', final: 'final', second: 'second session' };

// The storage code is TypeScript, so a small helper loads it (local folder, or R2 when STORAGE_DRIVER=r2).
async function loadStorage() {
  const helper = pathToFileURL(path.join(__dirname, 'lib', 'storage.mjs')).href;
  return (await import(helper)).loadStorage();
}

function pdfLines(r, courseTitles) {
  const details = [TYPE_LABELS[r.type]];
  if (r.session) details.push(SESSION_LABELS[r.session]);
  if (r.year) details.push(String(r.year));
  return [
    'SAMPLE FILE',
    r.title,
    `${r.course} - ${courseTitles.get(r.course)}`,
    details.join(', '),
    'Placeholder for development. Not university material.',
  ];
}

// Never fails the seed over one file: a failure leaves an orphan, reported by count (never by key).
async function deleteFiles(storage, keys, when) {
  const results = await Promise.allSettled(keys.map((key) => storage.delete(key)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) console.warn(`demo-first-year-courses: ${failed} stored file(s) could not be deleted ${when}`);
}

async function fileKeys(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT file_key FROM resources WHERE file_key IS NOT NULL AND course_id IN (SELECT id FROM courses WHERE code IN (:codes))',
    { transaction, replacements: { codes: CODES } },
  );
  return rows.map((row) => row.file_key);
}

async function deleteRows(queryInterface, transaction) {
  const replacements = { codes: CODES };
  await queryInterface.sequelize.query(
    'DELETE FROM resources WHERE course_id IN (SELECT id FROM courses WHERE code IN (:codes))',
    { transaction, replacements },
  );
  await queryInterface.sequelize.query('DELETE FROM courses WHERE code IN (:codes)', { transaction, replacements });
}

module.exports = {
  async up(queryInterface) {
    if (process.env.SEED_DEMO_DATA !== 'true') {
      console.log(SKIP_MESSAGE);
      return;
    }

    // Files first, then the rows that point at them; if the insert fails the files are removed again.
    const { getStorage, newResourceFileKey, samplePdf, contentType } = await loadStorage();
    const storage = getStorage();
    const courseTitles = new Map(COURSES.map((c) => [c.code, c.title]));
    const keys = new Map();
    try {
      for (const r of RESOURCES) {
        const key = newResourceFileKey();
        keys.set(r, key);
        await storage.put(key, samplePdf(pdfLines(r, courseTitles)), contentType);
      }
    } catch (error) {
      await deleteFiles(storage, [...keys.values()], 'after a failed upload');
      throw error;
    }

    let previousKeys = [];
    try {
      await queryInterface.sequelize.transaction(async (transaction) => {
        const now = new Date();
        previousKeys = await fileKeys(queryInterface, transaction);
        await deleteRows(queryInterface, transaction);
        await queryInterface.bulkInsert(
          'courses',
          COURSES.map((c) => ({ ...c, created_at: now, updated_at: now })),
          { transaction },
        );
        const [courseRows] = await queryInterface.sequelize.query(
          'SELECT id, code FROM courses WHERE code IN (:codes)',
          { transaction, replacements: { codes: CODES } },
        );
        const courseIds = new Map(courseRows.map((row) => [row.code, row.id]));
        await queryInterface.bulkInsert(
          'resources',
          RESOURCES.map((r) => ({
            course_id: courseIds.get(r.course),
            type: r.type,
            title: r.title,
            description: r.description ?? null,
            academic_year_start: r.year ?? null,
            exam_session: r.session ?? null,
            language: 'en',
            file_key: keys.get(r),
            external_url: url(r.path),
            solution_of_id: null,
            is_published: true,
            created_at: now,
            updated_at: now,
          })),
          { transaction },
        );
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
      keys = await fileKeys(queryInterface, transaction);
      await deleteRows(queryInterface, transaction);
    });
    if (keys.length > 0) {
      const { getStorage } = await loadStorage();
      await deleteFiles(getStorage(), keys, 'on undo');
    }
  },
};
