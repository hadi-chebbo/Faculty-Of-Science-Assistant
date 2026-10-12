'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // One row per failed sign-in, used to rate-limit sign-in by email and by IP. Deliberately
      // not linked to users: attempts for unknown emails are recorded too.
      await queryInterface.createTable('failed_sign_ins',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },

          // Trimmed and lowercased, as entered. Not necessarily an existing account.
          email: {
            type: Sequelize.STRING(254),
            allowNull: false,
          },

          // Client IP as reported by the hosting proxy, or 'unknown'. Long enough for IPv6.
          ip: {
            type: Sequelize.STRING(64),
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

      await queryInterface.addConstraint('failed_sign_ins', {
        fields: ['email'],
        type: 'check',
        where: Sequelize.literal("email = lower(btrim(email)) AND length(email) > 0"),
        name: 'failed_sign_ins_email_check',
        transaction,
      });

      await queryInterface.addConstraint('failed_sign_ins', {
        fields: ['ip'],
        type: 'check',
        where: Sequelize.literal("length(btrim(ip)) > 0"),
        name: 'failed_sign_ins_ip_check',
        transaction,
      });

      await queryInterface.addIndex('failed_sign_ins', {
        fields: ['email', 'created_at'],
        name: 'failed_sign_ins_email_created_at_idx',
        transaction,
      });

      await queryInterface.addIndex('failed_sign_ins', {
        fields: ['ip', 'created_at'],
        name: 'failed_sign_ins_ip_created_at_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('failed_sign_ins');
  }
};
