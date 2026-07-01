'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('notifications', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            title: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            body: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            scheduled_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            zone_id: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            notify_to: {
                type: Sequelize.ENUM('all', 'no_order', 'one_order', 'more_than_one_order'),
                allowNull: false
            },
            status: {
                type: Sequelize.ENUM('Pending', 'Sent', 'Failed', 'In Progress'),
                allowNull: false,
                defaultValue: 'Pending'
            },
            success: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            failed: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('notifications');
    }
};