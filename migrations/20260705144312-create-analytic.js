'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('analytics', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            session_id: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            user_id: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            action: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            from: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            params: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            }
        });
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('analytics');
    }
};