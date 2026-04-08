'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auth_sessions', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      refresh_token_hash: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true
      },
      device_id: {
        type: Sequelize.STRING(191),
        allowNull: false
      },
      device_type: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'unknown'
      },
      platform: {
        type: Sequelize.STRING(32),
        allowNull: false
      },
      app_version: {
        type: Sequelize.STRING(32),
        allowNull: false
      },
      ip_address: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.STRING(512),
        allowNull: true
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      last_rotated_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      invalidated_reason: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      reuse_detected_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('auth_sessions', ['user_id', 'revoked_at', 'expires_at']);
    await queryInterface.addIndex('auth_sessions', ['device_id', 'created_at']);
    await queryInterface.addIndex('auth_sessions', ['expires_at']);
    await queryInterface.addIndex('auth_sessions', ['revoked_at']);
    await queryInterface.addIndex('auth_sessions', ['reuse_detected_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auth_sessions');
  }
};
