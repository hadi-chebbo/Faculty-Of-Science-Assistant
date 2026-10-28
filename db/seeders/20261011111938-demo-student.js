'use strict';

// DEVELOPMENT ONLY. A fake student account for local work. Runs only when SEED_DEMO_DATA=true.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hash } = require('@node-rs/argon2');

// Beirut calendar day ("YYYY-MM-DD") of an instant, same rule as src/services/progress/beirut-date.ts.
function beirutDate(instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const EMAIL = 'demo.student@example.com';
const PASSWORD = 'demo-student-password';

module.exports = {
  async up(queryInterface) {
    if (process.env.SEED_DEMO_DATA !== 'true') {
      console.log('demo-student: skipped (SEED_DEMO_DATA is not "true")');
      return;
    }

    const passwordHash = await hash(PASSWORD); // Argon2id, library defaults

    await queryInterface.sequelize.transaction(async (transaction) => {
      const now = new Date();
      // Cascades to the user's bookmarks and completions.
      await queryInterface.bulkDelete('users', { email: EMAIL }, { transaction });

      await queryInterface.bulkInsert(
        'users',
        [{ email: EMAIL, name: 'Demo Student', password_hash: passwordHash, role: 'student', email_confirmed_at: now, created_at: now, updated_at: now }],
        { transaction },
      );

      const [[user]] = await queryInterface.sequelize.query(
        'SELECT id FROM users WHERE email = :email',
        { transaction, replacements: { email: EMAIL } },
      );
      const [resources] = await queryInterface.sequelize.query(
        `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id
         WHERE c.code LIKE 'DEMO%' AND r.is_published ORDER BY r.title LIMIT 3`,
        { transaction },
      );
      if (resources.length < 3) {
        throw new Error(
          'demo-student: demo resources not found. Run the demo-courses-and-resources seeder first (npm run db:seed).',
        );
      }

      await queryInterface.bulkInsert(
        'bookmarks',
        resources.map((r) => ({ user_id: user.id, resource_id: r.id, created_at: now })),
        { transaction },
      );
      await queryInterface.bulkInsert(
        'completions',
        resources.slice(0, 2).map((r) => ({ user_id: user.id, resource_id: r.id, created_at: now })),
        { transaction },
      );

      // Progress to look at in local demos. DEMO610 and DEMO410 are used by no e2e spec that marks
      // files (specs run in parallel and expect the files they mark to start as not done), so
      // keep it that way: DEMO610 has chapter 1 finished, two files of chapter 2 and one exam;
      // DEMO410 has one lecture.
      const demo = await queryInterface.sequelize.query(
        `SELECT r.id FROM resources r
           JOIN courses c ON c.id = r.course_id
           LEFT JOIN chapters ch ON ch.id = r.chapter_id
         WHERE r.is_published AND (
           (c.code = 'DEMO610' AND (
             (ch.position = 1 AND r.type IN ('lecture', 'notes', 'exercise'))
             OR r.title IN ('Sample lecture 2.1', 'Sample notes 2')
             OR r.id = (SELECT x.id FROM resources x WHERE x.course_id = c.id AND x.type = 'exam' AND x.is_published ORDER BY x.title LIMIT 1)
           ))
           OR (c.code = 'DEMO410' AND r.title = 'Sample lecture 1.1')
         )`,
        { transaction, type: queryInterface.sequelize.QueryTypes.SELECT },
      );
      if (demo.length === 0) throw new Error('demo-student: DEMO610 / DEMO410 files not found.');
      const ids = new Set(resources.map((r) => r.id));
      await queryInterface.bulkInsert(
        'completions',
        demo.filter((r) => !ids.has(r.id)).map((r) => ({ user_id: user.id, resource_id: r.id, created_at: now })),
        { transaction },
      );

      // Active days for the "This week" panel: today (Beirut) and up to two earlier days of the
      // current Beirut week, so a local demo always shows a few filled dots.
      const today = beirutDate(now);
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      const sinceMonday = (weekday + 6) % 7;
      const days = [0, 2, 3].filter((back) => back <= sinceMonday).map((back) => addDays(today, -back));
      await queryInterface.bulkInsert(
        'study_days',
        days.map((day) => ({ user_id: user.id, day, created_at: now })),
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('users', { email: EMAIL }, { transaction });
    });
  },
};
