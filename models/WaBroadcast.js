const { Model, DataTypes, Op } = require('sequelize');
const sequelize = require('../config/db');

class WaBroadcast extends Model { }

WaBroadcast.init({
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    caption: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    image: {
        type: DataTypes.TEXT('long'), // LONGTEXT for Base64 or URLs
        allowNull: true,
    },
    mime_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
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
    modelName: 'WaBroadcast',
    tableName: 'wa_broadcasts',
    underscored: true,
    timestamps: true
});

module.exports = WaBroadcast;
