const { Model, DataTypes, Op } = require('sequelize');
const sequelize = require('../config/db');

class User extends Model { }

User.init({
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    first_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    last_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    fcm_token: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    zone_id: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    flag: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    underscored: true,
    timestamps: true
});

module.exports = User;

