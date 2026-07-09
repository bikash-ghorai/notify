const Analytics = require('../models/Analytics');
const UserDevice = require('../models/UserDevice');
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const redisClient = require('../config/redis');

class AnalyticController {
    /**
     * Saves analytic details to the DB. Works for both Socket.io and HTTP.
     */
    static async saveAnalytics(data) {
        const { session_id, user_id, action, name, from, params } = data || {};

        if (action === 'click' && !from) {
            throw new Error('Required params are missing');
        }

        if (session_id && user_id && action && name) {
            return await Analytics.create({
                session_id,
                user_id,
                action,
                name,
                from,
                params
            });
        } else {
            throw new Error('Required params are missing');
        }
    }

    /**
     * Returns analytics data for the admin dashboard, grouped by session_id.
     */
    static async analytics(req, res) {
        try {
            const start = parseInt(req.body.start) || 0;
            const length = parseInt(req.body.length) || 10;
            const search = req.body.search || '';
            const user_id = req.body.user_id || '';

            const where = {};
            if (user_id) {
                where.user_id = user_id;
            }

            if (search) {
                where[Op.or] = [
                    { session_id: { [Op.like]: `%${search}%` } },
                    { user_id: { [Op.like]: `%${search}%` } }
                ];
            }

            // Get total count of grouped sessions
            const countResult = await Analytics.findAll({
                attributes: ['session_id'],
                where,
                group: ['session_id']
            });
            const total = countResult.length;

            // Get paginated grouped sessions
            const sessions = await Analytics.findAll({
                attributes: [
                    'session_id',
                    'user_id',
                    [sequelize.fn('MIN', sequelize.col('created_at')), 'created_at'],
                    [sequelize.fn('MAX', sequelize.col('created_at')), 'last_activity']
                ],
                where,
                group: ['session_id', 'user_id'],
                attributes: [
                    'session_id',
                    'user_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'activity_count']
                ],
                order: [[sequelize.fn('MAX', sequelize.col('created_at')), 'DESC']],
                limit: parseInt(length),
                offset: parseInt(start),
                raw: true
            });

            // Get active sessions from Redis
            let activeSessionSet = new Set();
            try {
                const activeSessions = await redisClient.sMembers('active_sessions');
                if (activeSessions && Array.isArray(activeSessions)) {
                    activeSessionSet = new Set(activeSessions);
                }
            } catch (redisError) {
                console.error('Error fetching active sessions from Redis:', redisError.message);
            }

            // Format data
            const formattedData = sessions.map(session => ({
                session_id: session.session_id,
                user_id: session.user_id,
                activity_count: session.activity_count || 0,
                created_at: session.created_at,
                status: activeSessionSet.has(session.session_id) ? 'active' : 'inactive'
            }));

            res.json({
                draw: parseInt(req.body.draw) || 1,
                recordsTotal: total,
                recordsFiltered: total,
                data: formattedData
            });

        } catch (error) {
            console.error('Error fetching analytics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    static async analyticsBySessionId(req, res) {
        try {
            const session_id = req.params.id || '';

            if (!session_id) {
                return res.status(400).json({ status: false, error: "Session ID is required" });
            }

            // Get filtered records and count
            const analyticsData = await Analytics.findAll({
                where: {
                    session_id: session_id
                },
                order: [['created_at', 'ASC']]
            });

            const deviceData = await UserDevice.findOne({
                where: {
                    session_id: session_id
                }
            });
            res.json({
                status: true, data: {
                    analytics: analyticsData,
                    device_info: deviceData
                }
            });
        } catch (error) {
            console.error("Failed to list analytics:", error);
            return res.status(500).json({ status: false, error: "Failed to list analytics" });
        }

    }

    static async saveDeviceInfo(data) {
        const { session_id, user_id, version, model, os_version } = data || {};

        if (!session_id || !user_id) {
            throw new Error('Required params are missing');
        }

        return await UserDevice.create({
            session_id,
            user_id,
            app_version: version,
            model,
            os_version
        });
    }
}

module.exports = AnalyticController;

