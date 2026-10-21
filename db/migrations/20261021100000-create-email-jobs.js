'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Outgoing email waiting to be sent (or already sent, kept for 30 days). RULE: payload never
      // holds a secret (no token, no password); handlers create secrets when the email is sent.
      await queryInterface.createTable('email_jobs',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },

          // Selects the handler that builds the message, e.g. 'confirm-email'.
          kind: {
            type: Sequelize.STRING,
            allowNull: false,
          },

          to_email: {
            type: Sequelize.STRING(254),
            allowNull: false,
          },

          payload: {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
          },

          status: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'pending',
          },

          attempts: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },

          next_attempt_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('now'),
          },

          // A short reason, never the address or a token.
          last_error: {
            type: Sequelize.STRING(500),
            allowNull: true,
          },

          sent_at: {
            type: Sequelize.DATE,
            allowNull: true,
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
        },
        { transaction }
      );

      await queryInterface.addConstraint('email_jobs', {
        fields: ['status'],
        type: 'check',
        where: { status: ['pending', 'sent', 'failed'] },
        name: 'email_jobs_status_check',
        transaction,
      });

      await queryInterface.addConstraint('email_jobs', {
        fields: ['attempts'],
        type: 'check',
        where: { attempts: { [Sequelize.Op.gte]: 0 } },
        name: 'email_jobs_attempts_check',
        transaction,
      });

      await queryInterface.addConstraint('email_jobs', {
        fields: ['to_email'],
        type: 'check',
        where: Sequelize.literal('to_email = lower(btrim(to_email)) AND length(to_email) > 0'),
        name: 'email_jobs_to_email_check',
        transaction,
      });

      await queryInterface.addIndex('email_jobs', {
        fields: ['status', 'next_attempt_at'],
        name: 'email_jobs_status_next_attempt_at_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('email_jobs');
  }
};
