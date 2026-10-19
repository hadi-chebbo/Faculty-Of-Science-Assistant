'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A resource may now have both a stored file and a backup link.
      await queryInterface.removeConstraint('resources', 'resources_at_most_one_source_check', { transaction });

      await queryInterface.removeConstraint('resources', 'resources_published_has_one_source_check', { transaction });

      // TRANSITIONAL rule: publishing needs a file or a link. The final rule, "published requires a
      // file" (a link being only a backup), comes in a later migration, once the demo data has files.
      await queryInterface.addConstraint('resources', {
        fields: ['is_published', 'file_key', 'external_url'],
        type: 'check',
        where: Sequelize.literal("is_published = false OR num_nonnulls(file_key, external_url) >= 1"),
        name: 'resources_published_has_source_check',
        transaction,
      });
    });
  },

  // Fails if a row with both a file and a link exists, which is correct: those rows cannot be
  // represented under the old rules and must be sorted out by hand first.
  async down (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint('resources', 'resources_published_has_source_check', { transaction });

      await queryInterface.addConstraint('resources', {
        fields: ['file_key', 'external_url'],
        type: 'check',
        where: Sequelize.literal("num_nonnulls(file_key, external_url) <= 1"),
        name: 'resources_at_most_one_source_check',
        transaction,
      });

      await queryInterface.addConstraint('resources', {
        fields: ['is_published', 'file_key', 'external_url'],
        type: 'check',
        where: Sequelize.literal("is_published = false OR num_nonnulls(file_key, external_url) = 1"),
        name: 'resources_published_has_one_source_check',
        transaction,
      });
    });
  }
};
