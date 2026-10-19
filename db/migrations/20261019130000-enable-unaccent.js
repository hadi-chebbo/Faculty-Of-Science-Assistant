'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Not a table change: the search page matches without regard to accents, so it needs the
  // unaccent() function from the contrib extension of the same name. Postgres ships it, and
  // Neon allows it.
  async up (queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS unaccent', { transaction });
    });
  },

  async down (queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS unaccent', { transaction });
    });
  }
};
