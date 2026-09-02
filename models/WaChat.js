const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WaChat = sequelize.define('WaChat', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    chat_jid: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    phone: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
    },
    last_message: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    last_message_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    unread_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    zone_ids: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    flag: {
        type: DataTypes.STRING(50),
        allowNull: true,
    }
}, {
    tableName: 'wa_chats',
    underscored: true,
    timestamps: true
});

module.exports = WaChat;