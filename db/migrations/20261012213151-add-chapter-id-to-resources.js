'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A resource with no chapter is listed under "General".
      await queryInterface.addColumn('resources', 'chapter_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'chapters', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        { transaction }
      );

      // That the chapter belongs to the same course as the resource is checked by the service layer.

      // Exams are never filed under a chapter.
      await queryInterface.addConstraint('resources', {
        fields: ['chapter_id', 'type'],
        type: 'check',
        where: Sequelize.literal("chapter_id IS NULL OR type <> 'exam'"),
        name: 'resources_chapter_not_on_exam_check',
        transaction,
      });

      await queryInterface.addIndex('resources', {
        fields: ['chapter_id'],
        name: 'resources_chapter_id_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint('resources', 'resources_chapter_not_on_exam_check', { transaction });
      await queryInterface.removeIndex('resources', 'resources_chapter_id_idx', { transaction });
      await queryInterface.removeColumn('resources', 'chapter_id', { transaction });
    });
  }
};
