const Analytics = require('../models/Analytics');

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
     * Returns analytics data for the admin dashboard.
     */
    static async analytics(req, res) {
        try {
            const { page = 1, limit = 10 } = req.body;

            const where = {};

            // If user_id is passed, fetch only that session data
            if (req.body.user_id) {
                where.user_id = req.body.user_id;
            }

            // If action is passed, fetch only that session data
            if (req.body.action) {
                where.action = req.body.action;
            }

            // If name is passed, fetch only that session data
            if (req.body.name) {
                where.name = req.body.name;
            }

            const analyticsData = await Analytics.findAndCountAll({
                where,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: (parseInt(page) - 1) * parseInt(limit)
            });

            res.json({
                success: true,
                data: analyticsData.rows,
                total: analyticsData.count
            });

        } catch (error) {
            console.error('Error fetching analytics:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = AnalyticController;

