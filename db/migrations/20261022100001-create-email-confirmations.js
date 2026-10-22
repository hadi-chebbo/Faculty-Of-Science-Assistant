'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('email_confirmations',
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

          // SHA-256 hex of the token in the emailed link. The raw token is never stored.
          token_hash: {
            type: Sequelize.STRING(64),
            allowNull: false,
          },

          expires_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },

          // Set when the link is used; a used link never works again.
          used_at: {
            type: Sequelize.DATE,
            allowNull: true,
          },

          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn('now'),
          },
        },
        { transaction }
      );

      await queryInterface.addConstraint('email_confirmations', {
        fields: ['token_hash'],
        type: 'check',
        where: Sequelize.literal("token_hash ~ '^[0-9a-f]{64}$'"),
        name: 'email_confirmations_token_hash_check',
        transaction,
      });

      await queryInterface.addConstraint('email_confirmations', {
        fields: ['token_hash'],
        type: 'unique',
        name: 'email_confirmations_token_hash_unique',
        transaction,
      });

      await queryInterface.addIndex('email_confirmations', {
        fields: ['user_id'],
        name: 'email_confirmations_user_id_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('email_confirmations');
  }
};
