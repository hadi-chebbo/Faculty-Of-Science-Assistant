'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A card on a student's to-do board. "Title or linked resource" is not a database rule: it is
      // enforced by the service, because deleting a resource sets resource_id to null and must not fail.
      await queryInterface.createTable('todos',
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
          },

          status: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'todo',
          },

          // 0 is the top of the column.
          position: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },

          title: {
            type: Sequelize.STRING(200),
            allowNull: false,
            defaultValue: '',
          },

          note: {
            type: Sequelize.TEXT,
            allowNull: false,
            defaultValue: '',
          },

          resource_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'resources', key: 'id' },
            onDelete: 'SET NULL',
          },

          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('now'),
          },

          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('now'),
          },

          status_changed_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('now'),
          },

          // Soft delete, kept a day so Undo works.
          deleted_at: {
            type: Sequelize.DATE,
            allowNull: true,
          },
        },
        { transaction }
      );

      await queryInterface.addConstraint('todos', {
        fields: ['status'],
        type: 'check',
        where: { status: ['todo', 'in_progress', 'done'] },
        name: 'todos_status_check',
        transaction,
      });

      await queryInterface.addConstraint('todos', {
        fields: ['position'],
        type: 'check',
        where: { position: { [Sequelize.Op.gte]: 0 } },
        name: 'todos_position_check',
        transaction,
      });

      await queryInterface.addConstraint('todos', {
        fields: ['title'],
        type: 'check',
        where: Sequelize.literal('char_length(title) <= 200'),
        name: 'todos_title_length_check',
        transaction,
      });

      await queryInterface.addConstraint('todos', {
        fields: ['note'],
        type: 'check',
        where: Sequelize.literal('char_length(note) <= 2000'),
        name: 'todos_note_length_check',
        transaction,
      });

      await queryInterface.addIndex('todos', {
        fields: ['user_id', 'status', 'position'],
        where: { deleted_at: null },
        name: 'todos_user_id_status_position_live_idx',
        transaction,
      });

      await queryInterface.addIndex('todos', {
        fields: ['resource_id'],
        name: 'todos_resource_id_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('todos');
  }
};
