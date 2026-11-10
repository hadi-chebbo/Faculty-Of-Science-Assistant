'use strict';

// DEVELOPMENT ONLY. Three obviously fake lecturers on files of DEMO510 and DEMO301, so the lecturer
// views have something to show. DEMO610 and DEMO410 are left alone (the progress demos use them).
// Runs only when SEED_DEMO_DATA=true, after the demo courses seeder.

const LECTURERS = [
  { name: 'Dr. Ada Example', slug: 'ada-example' },
  { name: 'Dr. Alan Sample', slug: 'alan-sample' },
  { name: 'Pr. Grace Placeholder', slug: 'grace-placeholder' },
];
const COURSE_CODES = ['DEMO510', 'DEMO301'];

async function removeDemoLecturers(queryInterface, transaction) {
  const slugs = LECTURERS.map((l) => l.slug);
  await queryInterface.sequelize.query(
    'UPDATE resources SET lecturer_id = NULL WHERE lecturer_id IN (SELECT id FROM lecturers WHERE slug IN (:slugs))',
    { transaction, replacements: { slugs } },
  );
  await queryInterface.bulkDelete('lecturers', { slug: slugs }, { transaction });
}

module.exports = {
  async up(queryInterface) {
    if (process.env.SEED_DEMO_DATA !== 'true') {
      console.log('demo-lecturers: skipped (SEED_DEMO_DATA is not "true")');
      return;
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      await removeDemoLecturers(queryInterface, transaction);
      const now = new Date();
      await queryInterface.bulkInsert(
        'lecturers',
        LECTURERS.map((l) => ({ ...l, created_at: now, updated_at: now })),
        { transaction },
      );
      const [lecturerRows] = await queryInterface.sequelize.query(
        'SELECT id, slug FROM lecturers WHERE slug IN (:slugs)',
        { transaction, replacements: { slugs: LECTURERS.map((l) => l.slug) } },
      );
      const idOf = new Map(lecturerRows.map((row) => [row.slug, row.id]));

      for (const code of COURSE_CODES) {
        const [files] = await queryInterface.sequelize.query(
          `SELECT r.id, r.type FROM resources r JOIN courses c ON c.id = r.course_id
           WHERE c.code = :code AND r.is_published ORDER BY r.type, r.title, r.id`,
          { transaction, replacements: { code } },
        );
        // Exams go round the three lecturers, so each has one where there are enough exams. Other
        // files go round them too, but every fourth one has none.
        let exam = 0;
        let other = 0;
        for (const file of files) {
          let slug = null;
          if (file.type === 'exam') slug = LECTURERS[exam++ % LECTURERS.length].slug;
          else if (other++ % 4 !== 3) slug = LECTURERS[(other - 1) % LECTURERS.length].slug;
          if (!slug) continue;
          await queryInterface.sequelize.query('UPDATE resources SET lecturer_id = :lecturer WHERE id = :id', {
            transaction,
            replacements: { lecturer: idOf.get(slug), id: file.id },
          });
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => removeDemoLecturers(queryInterface, transaction));
  },
};
