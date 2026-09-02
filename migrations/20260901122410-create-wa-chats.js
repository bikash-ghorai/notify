'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('wa_chats', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            chat_jid: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            phone: {
                type: Sequelize.STRING(50),
                allowNull: true,
            },
            last_message: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            last_message_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            unread_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            zone_ids: {
                type: Sequelize.JSON,
                defaultValue: []
            },
            flag: {
                type: Sequelize.STRING(50),
                allowNull: true,
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
        await queryInterface.dropTable('wa_chats');
    }
};