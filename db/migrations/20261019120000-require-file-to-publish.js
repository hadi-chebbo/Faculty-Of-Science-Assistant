'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A published resource without a file cannot stay published: it becomes a draft.
      // Nothing is deleted.
      await queryInterface.bulkUpdate(
        'resources',
        { is_published: false, updated_at: Sequelize.fn('now') },
        { is_published: true, file_key: null },
        { transaction },
      );

      await queryInterface.removeConstraint('resources', 'resources_published_has_source_check', { transaction });

      // Final rule: publishing needs a file. The link is only a backup.
      await queryInterface.addConstraint('resources', {
        fields: ['is_published', 'file_key'],
        type: 'check',
        where: Sequelize.literal("is_published = false OR file_key IS NOT NULL"),
        name: 'resources_published_has_file_check',
        transaction,
      });
    });
  },

  // Restores the transitional rule (published needs a file or a link). The rows that `up` turned
  // into drafts stay drafts: they are not republished.
  async down (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint('resources', 'resources_published_has_file_check', { transaction });

      await queryInterface.addConstraint('resources', {
        fields: ['is_published', 'file_key', 'external_url'],
        type: 'check',
        where: Sequelize.literal("is_published = false OR num_nonnulls(file_key, external_url) >= 1"),
        name: 'resources_published_has_source_check',
        transaction,
      });
    });
  }
};
