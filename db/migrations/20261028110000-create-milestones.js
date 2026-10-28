'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A milestone a student has earned: one row per user and key, kept forever.
      await queryInterface.createTable('milestones',
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

          key: {
            type: Sequelize.STRING,
            allowNull: false,
          },

          earned_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('now'),
          },
        },
        { transaction }
      );

      await queryInterface.addConstraint('milestones', {
        fields: ['user_id', 'key'],
        type: 'unique',
        name: 'milestones_user_id_key_unique',
        transaction,
      });

      // Must match MILESTONE_KEYS in src/db/constants.ts.
      await queryInterface.addConstraint('milestones', {
        fields: ['key'],
        type: 'check',
        name: 'milestones_key_check',
        where: {
          key: ['first_file', 'files_10', 'files_50', 'first_chapter', 'first_course', 'all_exams_of_course'],
        },
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('milestones');
  }
};
