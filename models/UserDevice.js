const { Model, DataTypes, Op } = require('sequelize');
const sequelize = require('../config/db');

class UserDevice extends Model { }

UserDevice.init({
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    session_id: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    user_id: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    app_version: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    device_id: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    model: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    os_version: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    battery_level: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    network_type: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'UserDevice',
    tableName: 'user_devices',
    underscored: true,
    timestamps: true
});

module.exports = UserDevice;

