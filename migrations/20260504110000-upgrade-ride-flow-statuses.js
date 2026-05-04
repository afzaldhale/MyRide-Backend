'use strict';

const ACTIVE_STATUSES = [
  'requested',
  'accepted',
  'driver_arriving',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'rejected'
];

const LEGACY_COMPATIBLE_STATUSES = [
  ...ACTIVE_STATUSES,
  'started'
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rides', 'rejected_driver_ids', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('rides', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });

    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_rides_status\" ADD VALUE IF NOT EXISTS 'driver_arriving';"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_rides_status\" ADD VALUE IF NOT EXISTS 'arrived';"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_rides_status\" ADD VALUE IF NOT EXISTS 'in_progress';"
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_rides_status\" ADD VALUE IF NOT EXISTS 'rejected';"
      );
      await queryInterface.sequelize.query(
        "UPDATE rides SET status = 'in_progress' WHERE status = 'started';"
      );
    } else {
      await queryInterface.changeColumn('rides', 'status', {
        type: Sequelize.ENUM(...LEGACY_COMPATIBLE_STATUSES),
        allowNull: false,
        defaultValue: 'requested'
      });
      await queryInterface.sequelize.query(
        "UPDATE rides SET status = 'in_progress' WHERE status = 'started';"
      );
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('rides', 'rejected_driver_ids');
    await queryInterface.removeColumn('rides', 'updated_at');

    await queryInterface.sequelize.query(
      "UPDATE rides SET status = 'accepted' WHERE status IN ('driver_arriving', 'arrived');"
    );
    await queryInterface.sequelize.query(
      "UPDATE rides SET status = 'started' WHERE status = 'in_progress';"
    );
    await queryInterface.sequelize.query(
      "UPDATE rides SET status = 'cancelled' WHERE status = 'rejected';"
    );

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'postgres') {
      await queryInterface.changeColumn('rides', 'status', {
        type: Sequelize.ENUM('requested', 'accepted', 'started', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'requested'
      });
    }
  }
};
