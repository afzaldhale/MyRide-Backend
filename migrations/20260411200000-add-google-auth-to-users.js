'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add Google sign-in fields to users table
    await queryInterface.addColumn('users', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      unique: true
    });

    await queryInterface.addColumn('users', 'google_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      unique: true
    });

    await queryInterface.addColumn('users', 'auth_provider', {
      type: Sequelize.ENUM('phone', 'google'),
      allowNull: false,
      defaultValue: 'phone'
    });

    // Make phone_number nullable for Google users
    await queryInterface.changeColumn('users', 'phone_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: false // Remove unique constraint since Google users won't have phone
    });

    // Add composite unique constraint for phone_number when auth_provider is 'phone'
    // This is complex in Sequelize, so we'll handle it in the model validation instead

    // Add indexes
    await queryInterface.addIndex('users', ['email'], {
      where: {
        email: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('users', ['google_id'], {
      where: {
        google_id: {
          [Sequelize.Op.ne]: null
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the added columns
    await queryInterface.removeColumn('users', 'email');
    await queryInterface.removeColumn('users', 'google_id');
    await queryInterface.removeColumn('users', 'auth_provider');

    // Restore phone_number constraints
    await queryInterface.changeColumn('users', 'phone_number', {
      type: Sequelize.STRING(20),
      allowNull: false,
      unique: true
    });
  }
};</content>
<parameter name="filePath">d:/ride_app_platform/backend/migrations/20260411200000-add-google-auth-to-users.js