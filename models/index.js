'use strict';

const Sequelize = require('sequelize');
const process = require('process');
require('dotenv').config();

const db = {};

const sequelize = new Sequelize(
    process.env.DB_DATABASE, 
    process.env.DB_USERNAME, 
    process.env.DB_PASSWORD, 
    {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false
    }
);

db.User = require('./User');
db.Notification = require('./Notification');
db.Analytics = require('./Analytics');
db.UserDevice = require('./UserDevice');
db.WaChat = require('./WaChat');
db.WaMessage = require('./WaMessage');

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;