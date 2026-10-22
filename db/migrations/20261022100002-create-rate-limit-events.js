'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // One row per limited action, used to rate-limit sign-up (by IP) and confirmation emails
      // (by address). Deliberately not linked to users: unknown addresses are counted too.
      await queryInterface.createTable('rate_limit_events',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },

          action: {
            type: Sequelize.STRING,
            allowNull: false,
          },

          // A client IP, or a trimmed lowercase email address, depending on the action.
          subject: {
            type: Sequelize.STRING(254),
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

      await queryInterface.addConstraint('rate_limit_events', {
        fields: ['action'],
        type: 'check',
        where: { action: ['sign-up', 'confirmation-email'] },
        name: 'rate_limit_events_action_check',
        transaction,
      });

      await queryInterface.addConstraint('rate_limit_events', {
        fields: ['subject'],
        type: 'check',
        where: Sequelize.literal('length(btrim(subject)) > 0'),
        name: 'rate_limit_events_subject_check',
        transaction,
      });

      await queryInterface.addIndex('rate_limit_events', {
        fields: ['action', 'subject', 'created_at'],
        name: 'rate_limit_events_action_subject_created_at_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('rate_limit_events');
  }
};
