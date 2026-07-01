const Notification = require('../models/Notification');

class NotificationController {
    static async scheduleNotification(req, res) {
        const { title, body, scheduled_at, zone_id, notify_to } = req.body;
        if (!title || !body || !scheduled_at || !zone_id || !notify_to) {
            return res.json({ status: false, message: "Invalid request data" });
        }
        try {
            const notification = await Notification.create({
                title,
                body,
                scheduled_at,
                zone_id,
                notify_to,
                status: 'Pending'
            });
            return res.json({ status: true, message: "Notification scheduled successfully.", data: notification });
        } catch (error) {
            console.error("Failed to process trigger:", error);
            return res.status(500).json({ status: false, error: "Failed to schedule notification" });
        }
    }
}

module.exports = NotificationController;

