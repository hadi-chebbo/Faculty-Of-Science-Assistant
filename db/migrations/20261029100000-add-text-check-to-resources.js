'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // The result of the text check made when a PDF is uploaded: how many pages the file has and how
      // many of them have text (a scanned page has none). Both null means "not checked".
      await queryInterface.addColumn('resources', 'page_count', { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await queryInterface.addColumn('resources', 'text_page_count', { type: Sequelize.INTEGER, allowNull: true }, { transaction });

      await queryInterface.addConstraint('resources', {
        fields: ['page_count', 'text_page_count'],
        type: 'check',
        where: Sequelize.literal(
          '(page_count IS NULL) = (text_page_count IS NULL) AND (page_count IS NULL OR (page_count >= 1 AND text_page_count >= 0 AND text_page_count <= page_count))'
        ),
        name: 'resources_text_check_valid_check',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint('resources', 'resources_text_check_valid_check', { transaction });
      await queryInterface.removeColumn('resources', 'text_page_count', { transaction });
      await queryInterface.removeColumn('resources', 'page_count', { transaction });
    });
  }
};
