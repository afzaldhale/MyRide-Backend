'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('drivers', 'full_name', {
      type: Sequelize.STRING(120),
      allowNull: true,
      after: 'user_id'
    });

    await queryInterface.addColumn('drivers', 'license_image_url', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'license_number'
    });

    await queryInterface.addColumn('drivers', 'rc_image_url', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'license_image_url'
    });

    await queryInterface.addColumn('drivers', 'profile_photo_url', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'rc_image_url'
    });

    await queryInterface.addColumn('drivers', 'is_profile_complete', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'profile_photo_url'
    });

    await queryInterface.addColumn('drivers', 'is_approved', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'is_profile_complete'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('drivers', 'is_approved');
    await queryInterface.removeColumn('drivers', 'is_profile_complete');
    await queryInterface.removeColumn('drivers', 'profile_photo_url');
    await queryInterface.removeColumn('drivers', 'rc_image_url');
    await queryInterface.removeColumn('drivers', 'license_image_url');
    await queryInterface.removeColumn('drivers', 'full_name');
  }
};
