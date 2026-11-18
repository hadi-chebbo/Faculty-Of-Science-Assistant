'use strict';

// First-year courses (semesters 1 and 2) are allowed: the course semester check goes from 3-6 to 1-6.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint('courses', 'courses_semester_check', { transaction });
      await queryInterface.addConstraint('courses', {
        fields: ['semester'],
        type: 'check',
        where: {
          semester: {
            [Op.between]: [1, 6],
          },
        },
        name: 'courses_semester_check',
        transaction,
      });
    });
  },

  // Fails while a course in semester 1 or 2 exists (the restored check rejects those rows); move or
  // delete them first.
  async down (queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint('courses', 'courses_semester_check', { transaction });
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
    });
  },
};
