const Analytics = require('../models/Analytics');
const UserDevice = require('../models/UserDevice');
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const redisClient = require('../config/redis');
const moment = require('moment');

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
            const start_date = req.body.start_date || '';
            const end_date = req.body.end_date || '';

            const where = {};
            if (user_id) {
                where.user_id = user_id;
            }

            if (start_date || end_date) {
                const dateRange = {};

                if (start_date) {
                    dateRange[Op.gte] = moment(start_date).startOf('day').toDate();
                }

                if (end_date) {
                    dateRange[Op.lte] = moment(end_date).endOf('day').toDate();
                }

                where.created_at = dateRange;
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
                    [sequelize.fn('MAX', sequelize.col('created_at')), 'last_activity'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'activity_count']
                ],
                where,
                group: ['session_id', 'user_id'],
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
                created_at: moment(session.created_at).format('YYYY-MM-DD HH:mm:ss'),
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
        const {
            session_id,
            user_id,
            version,
            device_id,
            brand,
            device_name,
            base_os,
            system_version,
            battery_level,
            network_type
        } = data || {};

        if (!session_id || !user_id) {
            throw new Error('Required params are missing');
        }

        return await UserDevice.create({
            session_id: session_id,
            user_id: user_id,
            app_version: version,
            device_id: device_id,
            model: brand+' '+device_name,
            os_version: base_os+' '+system_version,
            battery_level: battery_level,
            network_type: network_type
        });
    }
}

module.exports = AnalyticController;

