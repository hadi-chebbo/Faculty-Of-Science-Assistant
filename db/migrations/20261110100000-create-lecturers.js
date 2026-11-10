'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('lecturers',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },

          // As students know the person, e.g. "Dr. Ali Ghorayeb".
          name: {
            type: Sequelize.STRING(100),
            allowNull: false,
          },

          // The lecturer's name in addresses (?lecturer=SLUG). Set once; a rename never changes it.
          slug: {
            type: Sequelize.STRING(120),
            allowNull: false,
            unique: true,
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

      // Non-empty, with no leading or trailing spaces.
      await queryInterface.addConstraint('lecturers', {
        fields: ['name'],
        type: 'check',
        where: Sequelize.literal("length(btrim(name)) > 0 AND name = btrim(name)"),
        name: 'lecturers_name_check',
        transaction,
      });

      // Names are unique regardless of letter case.
      await queryInterface.addIndex('lecturers', {
        fields: [Sequelize.fn('lower', Sequelize.col('name'))],
        unique: true,
        name: 'lecturers_name_lower_unique',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('lecturers');
  }
};
