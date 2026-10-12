'use strict';

// DEVELOPMENT ONLY. A fake student account for local work. Runs only when SEED_DEMO_DATA=true.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hash } = require('@node-rs/argon2');

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
        [{ email: EMAIL, name: 'Demo Student', password_hash: passwordHash, role: 'student', created_at: now, updated_at: now }],
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
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('users', { email: EMAIL }, { transaction });
    });
  },
};
