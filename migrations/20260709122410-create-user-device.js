'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('user_devices', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            session_id: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            user_id: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            app_version: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            model: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            os_version: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            }
        });
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('user_devices');
    }
};