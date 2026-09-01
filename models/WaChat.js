const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WaChat = sequelize.define('WaChat', {
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
}, {
    tableName: 'wa_chats',
    timestamps: true,
    indexes: [
        { fields: ['last_message_at'] },
    ],
});

module.exports = WaChat;