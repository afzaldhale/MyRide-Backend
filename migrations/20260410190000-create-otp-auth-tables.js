'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      'otp_sessions',
      {
        id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          primaryKey: true
        },
        phone_number: {
          type: Sequelize.STRING(20),
          allowNull: false
        },
        verification_id: {
          type: Sequelize.STRING(191),
          allowNull: false
        },
        device_id: {
          type: Sequelize.STRING(191),
          allowNull: false
        },
        platform: {
          type: Sequelize.STRING(32),
          allowNull: false
        },
        app_version: {
          type: Sequelize.STRING(32),
          allowNull: false
        },
        attempt_count: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      },
      {
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
      }
    );

    await queryInterface.addIndex('otp_sessions', ['phone_number', 'created_at']);
    await queryInterface.addIndex('otp_sessions', ['device_id', 'created_at']);
    await queryInterface.addIndex('otp_sessions', ['expires_at']);
    await queryInterface.addIndex('otp_sessions', ['verification_id'], {
      unique: true
    });

    await queryInterface.createTable(
      'otp_logs',
      {
        id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          primaryKey: true
        },
        phone: {
          type: Sequelize.STRING(20),
          allowNull: false
        },
        ip: {
          type: Sequelize.STRING(64),
          allowNull: false
        },
        device: {
          type: Sequelize.STRING(191),
          allowNull: false
        },
        status: {
          type: Sequelize.STRING(80),
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        }
      },
      {
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
      }
    );

    await queryInterface.addIndex('otp_logs', ['phone', 'created_at']);
    await queryInterface.addIndex('otp_logs', ['ip', 'created_at']);
    await queryInterface.addIndex('otp_logs', ['device', 'created_at']);
    await queryInterface.addIndex('otp_logs', ['status', 'created_at']);

    await queryInterface.createTable(
      'otp_attempts',
      {
        id: {
          type: Sequelize.CHAR(36),
          allowNull: false,
          primaryKey: true
        },
        phone_number: {
          type: Sequelize.STRING(20),
          allowNull: false
        },
        ip_address: {
          type: Sequelize.STRING(64),
          allowNull: false
        },
        device_id: {
          type: Sequelize.STRING(191),
          allowNull: false
        },
        attempt_type: {
          type: Sequelize.ENUM('send', 'verify'),
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW')
        }
      },
      {
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci'
      }
    );

    await queryInterface.addIndex('otp_attempts', ['phone_number', 'created_at']);
    await queryInterface.addIndex('otp_attempts', ['ip_address', 'created_at']);
    await queryInterface.addIndex('otp_attempts', ['device_id', 'created_at']);
    await queryInterface.addIndex('otp_attempts', ['attempt_type', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('otp_attempts');
    await queryInterface.dropTable('otp_logs');
    await queryInterface.dropTable('otp_sessions');
  }
};
