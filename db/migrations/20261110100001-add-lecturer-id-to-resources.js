'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A resource has zero or one lecturer. A lecturer still used by a resource cannot be deleted.
      await queryInterface.addColumn('resources', 'lecturer_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'lecturers', key: 'id' },
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        },
        { transaction }
      );

      await queryInterface.addIndex('resources', {
        fields: ['lecturer_id'],
        name: 'resources_lecturer_id_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('resources', 'resources_lecturer_id_idx', { transaction });
      await queryInterface.removeColumn('resources', 'lecturer_id', { transaction });
    });
  }
};
