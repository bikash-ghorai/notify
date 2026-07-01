const { Op } = require('sequelize');
const Notification = require('../models/Notification');

class NotificationController {
    static async list(req, res) {
        try {
            const draw = req.body.draw || req.query.draw || 0;
            const search = req.body.search || req.query.search || '';
            const order_by = req.body.order_by || req.query.order_by || '';
            const order_type = req.body.order_type || req.query.order_type || '';
            const start = parseInt(req.body.start || req.query.start, 10) || 0;
            const length = parseInt(req.body.length || req.query.length, 10) || 10;

            let whereClause = {};

            if (search) {
                whereClause = {
                    [Op.or]: [
                        { title: { [Op.like]: `%${search}%` } },
                        { body: { [Op.like]: `%${search}%` } },
                        { zone_id: { [Op.like]: `%${search}%` } },
                        { notify_to: { [Op.like]: `%${search}%` } },
                        { status: { [Op.like]: `%${search}%` } }
                    ]
                };
            }

            // Calculate offset (avoid negative values)
            let offset = start;
            if (offset < 0) {
                offset = 0;
            }

            // Get total records count (before filter)
            const totalRecords = await Notification.count();

            // Get filtered records and count
            const { count: filteredCount, rows: notifications } = await Notification.findAndCountAll({
                where: whereClause,
                offset: offset,
                limit: length,
                order: [
                    [order_by || 'id', order_type || 'desc']
                ]
            });

            return res.json({
                status: true,
                draw: draw,
                recordsTotal: totalRecords,
                recordsFiltered: filteredCount,
                data: notifications,
            });
        } catch (error) {
            console.error("Failed to list notifications:", error);
            return res.status(500).json({ status: false, error: "Failed to list notifications" });
        }
    }

    static async create(req, res) {
        const { title, body, scheduled_at, zone_id, notify_to } = req.body;
        console.log(req.body);
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

    static async update(req, res) {
        const { id, title, body, scheduled_at, zone_id, notify_to } = req.body;
        if (!id || !title || !body || !scheduled_at || !zone_id || !notify_to) {
            return res.json({ status: false, message: "Invalid request data" });
        }
        try {
            await Notification.update({
                title,
                body,
                scheduled_at,
                zone_id,
                notify_to
            }, {
                where: { id }
            });
            const notification = await Notification.findByPk(id);
            return res.json({ status: true, message: "Notification updated successfully.", data: notification });
        } catch (error) {
            console.error("Failed to process trigger:", error);
            return res.status(500).json({ status: false, error: "Failed to update notification" });
        }
    }

    static async edit(req, res) {
        const { id } = req.body;
        if (!id) {
            return res.json({ status: false, message: "Invalid request data" });
        }
        try {
            const notification = await Notification.findByPk(id);
            return res.json({ status: true, message: "Notification data successfully.", data: notification });
        } catch (error) {
            console.error("Failed to process trigger:", error);
            return res.status(500).json({ status: false, error: "Failed to update notification status" });
        }
    }

    static async delete(req, res) {
        const { id } = req.body;
        if (!id) {
            return res.json({ status: false, message: "Invalid request data" });
        }
        try {
            const notification = await Notification.destroy({
                where: {
                    id
                }
            });
            return res.json({ status: true, message: "Notification deleted successfully.", data: notification });
        } catch (error) {
            console.error("Failed to process trigger:", error);
            return res.status(500).json({ status: false, error: "Failed to update notification status" });
        }
    }
}

module.exports = NotificationController;

