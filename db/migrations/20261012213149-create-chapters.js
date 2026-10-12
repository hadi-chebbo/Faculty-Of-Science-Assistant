'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('chapters',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },

          course_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'courses', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },

          // Order of the chapter within its course, starting at 1.
          position: {
            type: Sequelize.SMALLINT,
            allowNull: false,
          },

          title: {
            type: Sequelize.STRING(200),
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

      await queryInterface.addConstraint('chapters', {
        fields: ['position'],
        type: 'check',
        where: {
          position: {
            [Op.between]: [1, 200],
          },
        },
        name: 'chapters_position_check',
        transaction,
      });

      await queryInterface.addConstraint('chapters', {
        fields: ['title'],
        type: 'check',
        where: Sequelize.literal("length(btrim(title)) > 0"),
        name: 'chapters_title_check',
        transaction,
      });

      // The unique constraint also serves as the index for listing a course's chapters in order.
      await queryInterface.addConstraint('chapters', {
        fields: ['course_id', 'position'],
        type: 'unique',
        name: 'chapters_course_id_position_unique',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('chapters');
  }
};
