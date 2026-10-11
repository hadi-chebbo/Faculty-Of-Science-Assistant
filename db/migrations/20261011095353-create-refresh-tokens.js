'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('refresh_tokens',
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

          // SHA-256 hex of the token. The raw token is never stored.
          token_hash: {
            type: Sequelize.STRING(64),
            allowNull: false,
          },

          // One rotation chain; reuse of a token revokes the whole family.
          family_id: {
            type: Sequelize.UUID,
            allowNull: false,
          },

          expires_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },

          revoked_at: {
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

      await queryInterface.addConstraint('refresh_tokens', {
        fields: ['token_hash'],
        type: 'check',
        where: Sequelize.literal("token_hash ~ '^[0-9a-f]{64}$'"),
        name: 'refresh_tokens_token_hash_check',
        transaction,
      });

      await queryInterface.addConstraint('refresh_tokens', {
        fields: ['token_hash'],
        type: 'unique',
        name: 'refresh_tokens_token_hash_unique',
        transaction,
      });

      // Compares two columns, so it is written as SQL.
      await queryInterface.addConstraint('refresh_tokens', {
        fields: ['expires_at', 'created_at'],
        type: 'check',
        where: Sequelize.literal("expires_at > created_at"),
        name: 'refresh_tokens_expires_at_check',
        transaction,
      });

      await queryInterface.addIndex('refresh_tokens', {
        fields: ['user_id'],
        name: 'refresh_tokens_user_id_idx',
        transaction,
      });

      await queryInterface.addIndex('refresh_tokens', {
        fields: ['family_id'],
        name: 'refresh_tokens_family_id_idx',
        transaction,
      });

      await queryInterface.addIndex('refresh_tokens', {
        fields: ['expires_at'],
        name: 'refresh_tokens_expires_at_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('refresh_tokens');
  }
};
