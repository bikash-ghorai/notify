'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('wa_chats', {
            jid: {
                type: DataTypes.STRING(100),
                primaryKey: true,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            phone: {
                type: DataTypes.STRING(50),
                allowNull: true,
            },
            last_message: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            last_message_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            unread_count: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
        });
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('wa_chats');
    }
};