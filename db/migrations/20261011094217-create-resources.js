'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const { Op } = Sequelize;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable('resources',
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
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },

          type: {
            type: Sequelize.STRING(20),
            allowNull: false,
          },

          title: {
            type: Sequelize.STRING(200),
            allowNull: false,
          },

          description: {
            type: Sequelize.TEXT,
            allowNull: true,
          },

          // Starting calendar year of the academic year (2023 means 2023-2024).
          academic_year_start: {
            type: Sequelize.SMALLINT,
            allowNull: true,
          },

          exam_session: {
            type: Sequelize.STRING(10),
            allowNull: true,
          },

          language: {
            type: Sequelize.STRING(2),
            allowNull: false,
            defaultValue: 'en',
          },

          // Storage key of an uploaded file.
          file_key: {
            type: Sequelize.TEXT,
            allowNull: true,
          },

          external_url: {
            type: Sequelize.TEXT,
            allowNull: true,
          },

          solution_of_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'resources', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },

          is_published: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
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

      // Allowed values. A NULL column passes a check, so nullable columns need no extra clause.
      await queryInterface.addConstraint('resources', {
        fields: ['type'],
        type: 'check',
        where: {
          type: {
            [Op.in]: ['lecture', 'notes', 'exercise', 'exam', 'solution', 'other'],
          },
        },
        name: 'resources_type_check',
        transaction,
      });

      await queryInterface.addConstraint('resources', {
        fields: ['exam_session'],
        type: 'check',
        where: {
          exam_session: {
            [Op.in]: ['partial', 'final', 'second'],
          },
        },
        name: 'resources_exam_session_check',
        transaction,
      });

      await queryInterface.addConstraint('resources', {
        fields: ['language'],
        type: 'check',
        where: {
          language: {
            [Op.in]: ['en', 'fr'],
          },
        },
        name: 'resources_language_check',
        transaction,
      });

      await queryInterface.addConstraint('resources', {
        fields: ['academic_year_start'],
        type: 'check',
        where: {
          academic_year_start: {
            [Op.between]: [1990, 2100],
          },
        },
        name: 'resources_academic_year_start_check',
        transaction,
      });

      await queryInterface.addConstraint('resources', {
        fields: ['external_url'],
        type: 'check',
        where: {
          external_url: {
            [Op.like]: 'https://%',
          },
        },
        name: 'resources_external_url_https_check',
        transaction,
      });

      await queryInterface.addConstraint('resources', {
        fields: ['title'],
        type: 'check',
        where: Sequelize.literal("length(btrim(title)) > 0"),
        name: 'resources_title_check',
        transaction,
      });

      // Rules that compare several columns have no operator form, so they are written as SQL.

      // A session is required on exams and forbidden on everything else.
      await queryInterface.addConstraint('resources', {
        fields: ['exam_session', 'type'],
        type: 'check',
        where: Sequelize.literal("(exam_session IS NOT NULL) = (type = 'exam')"),
        name: 'resources_exam_session_iff_exam_check',
        transaction,
      });

      // Only a solution may point at the resource it solves, and never at itself.
      await queryInterface.addConstraint('resources', {
        fields: ['solution_of_id', 'type'],
        type: 'check',
        where: Sequelize.literal("solution_of_id IS NULL OR type = 'solution'"),
        name: 'resources_solution_of_requires_solution_type_check',
        transaction,
      });

      await queryInterface.addConstraint('resources', {
        fields: ['solution_of_id', 'id'],
        type: 'check',
        where: Sequelize.literal("solution_of_id IS NULL OR solution_of_id <> id"),
        name: 'resources_solution_of_not_self_check',
        transaction,
      });

      // A resource is an uploaded file or an external link, never both.
      await queryInterface.addConstraint('resources', {
        fields: ['file_key', 'external_url'],
        type: 'check',
        where: Sequelize.literal("num_nonnulls(file_key, external_url) <= 1"),
        name: 'resources_at_most_one_source_check',
        transaction,
      });

      // It cannot be published without one of them.
      await queryInterface.addConstraint('resources', {
        fields: ['is_published', 'file_key', 'external_url'],
        type: 'check',
        where: Sequelize.literal("is_published = false OR num_nonnulls(file_key, external_url) = 1"),
        name: 'resources_published_has_one_source_check',
        transaction,
      });

      await queryInterface.addIndex('resources', {
        fields: ['course_id', 'type'],
        name: 'resources_course_id_type_idx',
        transaction,
      });

      await queryInterface.addIndex('resources', {
        fields: ['solution_of_id'],
        name: 'resources_solution_of_id_idx',
        transaction,
      });
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('resources');
  }
};
