const { Op } = require('sequelize');
const WaBroadcast = require('../models/WaBroadcast');

class BroadcastController {
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
                        { caption: { [Op.like]: `%${search}%` } },
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
            const totalRecords = await WaBroadcast.count();

            // Get filtered records and count
            const { count: filteredCount, rows: broadcasts } = await WaBroadcast.findAndCountAll({
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
                data: broadcasts,
            });
        } catch (error) {
            console.error("Failed to list broadcasts:", error);
            return res.json({ status: false, message: error.message, data: [] });
        }
    }

    static async create(req, res) {
        const { caption, image, mime_type, scheduled_at, zone_id, notify_to } = req.body;

        if ((!caption && !image) || (image && !mime_type) || !scheduled_at || !zone_id || !notify_to) {
            return res.json({ status: false, message: "Invalid request data" });
        }
        try {
            const broadcast = await WaBroadcast.create({
                caption,
                image,
                mime_type,
                scheduled_at,
                zone_id,
                notify_to,
                status: 'Pending'
            });
            return res.json({ status: true, message: "Broadcast scheduled successfully.", data: broadcast });
        } catch (error) {
            console.error("Failed to process trigger:", error);
            return res.json({ status: false, message: error.message, data: {} });
        }
    }

    static async update(req, res) {
        const { id, caption, image, mime_type, scheduled_at, zone_id, notify_to } = req.body;

        if (!id || (!caption && !image) || (image && !mime_type) || !scheduled_at || !zone_id || !notify_to) {
            return res.json({ status: false, message: "Invalid request data" });
        }
        try {
            await WaBroadcast.update({
                caption,
                image,
                mime_type,
                scheduled_at,
                zone_id,
                notify_to
            }, {
                where: { id }
            });
            const broadcast = await WaBroadcast.findByPk(id);
            return res.json({ status: true, message: "Broadcast updated successfully.", data: broadcast });
        } catch (error) {
            console.error("Failed to process trigger:", error);
            return res.json({ status: false, message: error.message, data: {} });
        }
    }

    static async edit(req, res) {
        const id = req.params.id;
        if (!id) {
            return res.json({ status: false, message: "Invalid request data" });
        }
        try {
            const broadcast = await WaBroadcast.findByPk(id);
            return res.json({ status: true, message: "Broadcast data successfully.", data: broadcast });
        } catch (error) {
            console.error("Failed to process trigger:", error);
            return res.json({ status: false, message: error.message, data: {} });
        }
    }

    static async delete(req, res) {
        const { id } = req.body;
        if (!id) {
            return res.json({ status: false, message: "Invalid request data" });
        }
        try {
            const broadcast = await WaBroadcast.destroy({
                where: {
                    id
                }
            });
            return res.json({ status: true, message: "Broadcast deleted successfully.", data: broadcast });
        } catch (error) {
            console.error("Failed to process trigger:", error);
            return res.json({ status: false, message: error.message, data: {} });
        }
    }
}

module.exports = BroadcastController;

