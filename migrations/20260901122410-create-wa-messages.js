'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('wa_messages', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            chat_id: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            message_id: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            message_type: {
                type: Sequelize.STRING(50),
                defaultValue: 'text', // text, image, video, document, etc.
            },
            message: {
                type: Sequelize.TEXT('long'),
                allowNull: true,
            },
            media_data: {
                type: Sequelize.TEXT('long'), // LONGTEXT for Base64 or URLs
                allowNull: true,
            },
            mime_type: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            is_from_me: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            status: {
                type: Sequelize.ENUM('Send', 'Delivered', 'Read', 'Failed'),
                defaultValue: 'Send',
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
        await queryInterface.dropTable('wa_messages');
    }
};