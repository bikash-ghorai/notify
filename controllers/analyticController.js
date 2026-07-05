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
}

module.exports = AnalyticController;

