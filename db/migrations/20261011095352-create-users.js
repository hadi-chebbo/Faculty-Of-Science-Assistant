'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('users',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },

          email: {
            type: Sequelize.STRING(254),
            allowNull: false,
          },

          name: {
            type: Sequelize.STRING(100),
            allowNull: true,
          },

          password_hash: {
            type: Sequelize.TEXT,
            allowNull: false,
          },

          role: {
            type: Sequelize.STRING(10),
            allowNull: false,
            defaultValue: 'student',
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

      // Stored lowercase and trimmed, with something on both sides of the @.
      await queryInterface.addConstraint('users', {
        fields: ['email'],
        type: 'check',
        where: Sequelize.literal("email = lower(btrim(email)) AND email LIKE '%_@_%'"),
        name: 'users_email_check',
        transaction,
      });

      await queryInterface.addConstraint('users', {
        fields: ['email'],
        type: 'unique',
        name: 'users_email_unique',
        transaction,
      });

      // Optional, but not blank when present.
      await queryInterface.addConstraint('users', {
        fields: ['name'],
        type: 'check',
        where: Sequelize.literal("name IS NULL OR length(btrim(name)) > 0"),
        name: 'users_name_check',
        transaction,
      });

      await queryInterface.addConstraint('users', {
        fields: ['password_hash'],
        type: 'check',
        where: Sequelize.literal("length(btrim(password_hash)) > 0"),
        name: 'users_password_hash_check',
        transaction,
      });

      await queryInterface.addConstraint('users', {
        fields: ['role'],
        type: 'check',
        where: {
          role: {
            [Op.in]: ['student', 'admin'],
          },
        },
        name: 'users_role_check',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('users');
  }
};
