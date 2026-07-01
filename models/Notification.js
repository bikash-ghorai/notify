const { Model, DataTypes, Op } = require('sequelize');
const sequelize = require('../config/db');

class Notification extends Model { }

Notification.init({
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    scheduled_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    zone_id: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    notify_to: {
        type: DataTypes.ENUM('all', 'no_order', 'one_order', 'more_than_one_order'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Sent', 'Failed', 'In Progress'),
        allowNull: false,
        defaultValue: 'Pending'
    },
    success: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    failed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    underscored: true,
    timestamps: true
});

module.exports = Notification;

