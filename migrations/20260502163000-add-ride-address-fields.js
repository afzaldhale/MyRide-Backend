'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rides', 'pickup_address', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('rides', 'drop_address', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('rides', 'drop_address');
    await queryInterface.removeColumn('rides', 'pickup_address');
  }
};
