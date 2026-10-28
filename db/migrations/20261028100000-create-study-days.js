'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // An active day: a Beirut calendar day on which the student made at least one completion.
      // Kept forever, even if the completion is later removed.
      await queryInterface.createTable('study_days',
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

          day: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },

          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('now'),
          },
        },
        { transaction }
      );

      await queryInterface.addConstraint('study_days', {
        fields: ['user_id', 'day'],
        type: 'unique',
        name: 'study_days_user_id_day_unique',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('study_days');
  }
};
