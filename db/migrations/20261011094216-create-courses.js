'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('courses',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },

          code: {
            type: Sequelize.STRING(20),
            allowNull: false,
          },

          title: {
            type: Sequelize.STRING(200),
            allowNull: false,
          },

          semester: {
            type: Sequelize.SMALLINT,
            allowNull: false,
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

      await queryInterface.addConstraint('courses', {
        fields: ['semester'],
        type: 'check',
        where: {
          semester: {
            [Op.between]: [3, 6],
          },
        },
        name: 'courses_semester_check',
        transaction,
      });

      // Non-empty, with no leading or trailing spaces.
      await queryInterface.addConstraint('courses', {
        fields: ['code'],
        type: 'check',
        where: Sequelize.literal("length(btrim(code)) > 0 AND code = btrim(code)"),
        name: 'courses_code_check',
        transaction,
      });

      await queryInterface.addConstraint('courses', {
        fields: ['title'],
        type: 'check',
        where: Sequelize.literal("length(btrim(title)) > 0"),
        name: 'courses_title_check',
        transaction,
      });

      // Course codes are unique regardless of letter case.
      await queryInterface.addIndex('courses', {
        fields: [Sequelize.fn('lower', Sequelize.col('code'))],
        unique: true,
        name: 'courses_code_lower_unique',
        transaction,
      });

      await queryInterface.addIndex('courses', {
        fields: ['semester'],
        name: 'courses_semester_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('courses');
  }
};
