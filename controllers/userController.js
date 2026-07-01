const User = require('../models/User');

class UserController {
    /**
     * Handles /api/sync-users endpoint
     */
    static async syncUsers(req, res) {
        const users = req.body.users;

        if (!users || !users.length) {
            return res.json({ status: false, message: "No users provided" });
        }

        // Map incoming users to objects matching User model fields
        const values = users.map(u => ({
            user_id: u.user_id,
            first_name: u.first_name,
            last_name: u.last_name,
            phone: u.phone,
            fcm_token: u.fcm_token,
            zone_id: u.zone_id,
            flag: u.flag,
            status: u.status
        }));

        try {
            await User.bulkCreate(values, {
                updateOnDuplicate: ['first_name', 'last_name', 'phone', 'fcm_token', 'zone_id', 'flag', 'status']
            });
            return res.json({ status: true, message: `Successfully synced ${users.length} users.` });
        } catch (error) {
            console.error("Database sync failed:", error);
            return res.status(500).json({ status: false, error: "Database sync failed" });
        }
    }
}

module.exports = UserController;

