'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Set by the admin to block the account: null means not blocked. The row is kept, so the
      // address cannot be used to sign up again.
      await queryInterface.addColumn('users', 'blocked_at', { type: Sequelize.DATE, allowNull: true }, { transaction });
    });
  },

  async down (queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('users', 'blocked_at', { transaction });
    });
  }
};
