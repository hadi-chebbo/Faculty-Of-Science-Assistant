'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('bookmarks',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },

          user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },

          resource_id: {
            type: Sequelize.INTEGER,
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

      await queryInterface.addConstraint('bookmarks', {
        fields: ['user_id', 'resource_id'],
        type: 'unique',
        name: 'bookmarks_user_id_resource_id_unique',
        transaction,
      });

      await queryInterface.addIndex('bookmarks', {
        fields: ['resource_id'],
        name: 'bookmarks_resource_id_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('bookmarks');
  }
};
