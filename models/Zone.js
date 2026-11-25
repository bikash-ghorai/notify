const { Model, DataTypes, Op } = require('sequelize');
const sequelize = require('../config/db');

class Zone extends Model { }

Zone.init({
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },
    zone_id: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'Zone',
    tableName: 'zones',
    underscored: true,
    timestamps: true
});

module.exports = Zone;