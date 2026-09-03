'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('wa_broadcasts', {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
            caption: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            image: {
                type: Sequelize.TEXT('long'), // LONGTEXT for Base64 or URLs
                allowNull: true,
            },
            mime_type: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            scheduled_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            zone_id: {
                type: Sequelize.STRING(255),
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
        await queryInterface.dropTable('wa_broadcasts');
    }
};