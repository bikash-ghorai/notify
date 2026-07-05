const { Model, DataTypes, Op } = require('sequelize');
const sequelize = require('../config/db');

class Analytics extends Model { }

Analytics.init({
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
    action: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    from: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    params: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'Analytics',
    tableName: 'analytics',
    underscored: true,
    timestamps: true
});

module.exports = Analytics;

