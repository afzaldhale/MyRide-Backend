'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rides', 'vehicle_type', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: 'economy',
      after: 'fare'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('rides', 'vehicle_type');
  }
};