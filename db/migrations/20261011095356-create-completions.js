'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('completions',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },

          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },

          resource_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'resources', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },

          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('now'),
          },
        },
        { transaction }
      );

      await queryInterface.addConstraint('completions', {
        fields: ['user_id', 'resource_id'],
        type: 'unique',
        name: 'completions_user_id_resource_id_unique',
        transaction,
      });

      await queryInterface.addIndex('completions', {
        fields: ['resource_id'],
        name: 'completions_resource_id_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('completions');
  }
};
