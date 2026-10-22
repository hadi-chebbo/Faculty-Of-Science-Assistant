'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Null until the student follows the link in the confirmation email. Signing in needs it.
      await queryInterface.addColumn('users',
        'email_confirmed_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction }
      );

      // Accounts that exist before confirmation did (the admin, seeded students) count as confirmed.
      await queryInterface.sequelize.query(
        'UPDATE users SET email_confirmed_at = created_at WHERE email_confirmed_at IS NULL',
        { transaction }
      );
    });
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('users', 'email_confirmed_at');
  }
};
