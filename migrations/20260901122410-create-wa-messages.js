'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('wa_messages', {
            id: {
                type: DataTypes.STRING(100),
                primaryKey: true,
                allowNull: false,
            },
            chat_jid: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            sender_jid: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            sender_name: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            message_type: {
                type: DataTypes.STRING(50),
                defaultValue: 'conversation',
            },
            text: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            media_data: {
                type: DataTypes.TEXT('long'),
                allowNull: true,
            },
            mime_type: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },
            is_from_me: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            status: {
                type: DataTypes.STRING(50),
                defaultValue: 'delivered',
            },
            timestamp: {
                type: DataTypes.BIGINT,
                allowNull: false,
            },
        });
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('wa_messages');
    }
};