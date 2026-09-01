const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WaMessage = sequelize.define('WaMessage', {
    id: {
        type: DataTypes.STRING(100),
        primaryKey: true,
        allowNull: false,
    },
    message_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    chat_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    message_type: {
        type: DataTypes.STRING(50),
        defaultValue: 'text', // text, image, video, document, etc.
    },
    message: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
    },
    media_data: {
        type: DataTypes.TEXT('long'), // LONGTEXT for Base64 or URLs
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
        defaultValue: 'delivered', // send, delivered, read, failed, etc.
    }
}, {
    tableName: 'wa_messages',
    timestamps: true
});

module.exports = WaMessage;