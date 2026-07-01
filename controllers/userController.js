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

        try {
            // Deduplicate incoming users list by user_id, keeping the latest one
            const uniqueUsersMap = new Map();
            for (const u of users) {
                uniqueUsersMap.set(u.user_id, u);
            }

            const userIds = Array.from(uniqueUsersMap.keys());
            const existingUsers = await User.findAll({
                where: {
                    user_id: userIds
                }
            });

            const existingUserMap = new Map(existingUsers.map(u => [u.user_id, u]));

            const transaction = await User.sequelize.transaction();
            try {
                for (const u of uniqueUsersMap.values()) {
                    const existingUser = existingUserMap.get(u.user_id);
                    if (existingUser) {
                        await existingUser.update({
                            first_name: u.first_name,
                            last_name: u.last_name,
                            phone: u.phone,
                            fcm_token: u.fcm_token,
                            zone_id: u.zone_id,
                            flag: u.flag,
                            status: u.status
                        }, { transaction });
                    } else {
                        await User.create({
                            user_id: u.user_id,
                            first_name: u.first_name,
                            last_name: u.last_name,
                            phone: u.phone,
                            fcm_token: u.fcm_token,
                            zone_id: u.zone_id,
                            flag: u.flag,
                            status: u.status
                        }, { transaction });
                    }
                }
                await transaction.commit();
            } catch (err) {
                await transaction.rollback();
                throw err;
            }

            return res.json({ status: true, message: `Successfully synced ${uniqueUsersMap.size} users.` });
        } catch (error) {
            console.error("Database sync failed:", error);
            return res.status(500).json({ status: false, error: "Database sync failed" });
        }
    }
}

module.exports = UserController;

