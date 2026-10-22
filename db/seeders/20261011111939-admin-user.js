'use strict';

// Runs in any environment, deliberately: this is how the single admin account is created.
// Requires ADMIN_EMAIL and ADMIN_PASSWORD. Never logs the password or the hash.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hash } = require('@node-rs/argon2');

const MIN_PASSWORD_LENGTH = 12;

const normaliseEmail = (value) => value.trim().toLowerCase();

module.exports = {
  async up(queryInterface) {
    const rawEmail = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!rawEmail || !password) {
      console.log('admin-user: skipped (ADMIN_EMAIL and ADMIN_PASSWORD are not both set)');
      return;
    }

    const email = normaliseEmail(rawEmail);
    if (!email) {
      console.log('admin-user: skipped (ADMIN_EMAIL is blank)');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`admin-user: ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }

    const passwordHash = await hash(password); // Argon2id, library defaults

    await queryInterface.sequelize.transaction(async (transaction) => {
      const now = new Date();
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM users WHERE email = :email',
        { transaction, replacements: { email } },
      );

      if (existing.length > 0) {
        await queryInterface.bulkUpdate(
          'users',
          { password_hash: passwordHash, role: 'admin', updated_at: now },
          { email },
          { transaction },
        );
        // Set it if missing, never overwrite an existing confirmation time.
        await queryInterface.sequelize.query(
          'UPDATE users SET email_confirmed_at = :now WHERE email = :email AND email_confirmed_at IS NULL',
          { transaction, replacements: { now, email } },
        );
        console.log('admin-user: updated existing admin');
      } else {
        await queryInterface.bulkInsert(
          'users',
          [{ email, name: null, password_hash: passwordHash, role: 'admin', email_confirmed_at: now, created_at: now, updated_at: now }],
          { transaction },
        );
        console.log('admin-user: created admin');
      }
    });
  },

  async down(queryInterface) {
    const rawEmail = process.env.ADMIN_EMAIL;
    if (!rawEmail) {
      console.log('admin-user: nothing to undo (ADMIN_EMAIL is not set)');
      return;
    }
    const email = normaliseEmail(rawEmail);
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('users', { email }, { transaction });
    });
  },
};
