const { Op } = require('sequelize');
const WaBroadcast = require('../models/WaBroadcast');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');

async function startBroadcast() {
    console.log(`[Worker] Started checking for scheduled broadcasts at: ${new Date().toISOString()}`);
    try {
        // 1. Fetch pending notifications scheduled to be sent now or in the past
        const pendingBroadcast = await WaBroadcast.findOne({
            where: {
                status: 'Pending',
                scheduled_at: {
                    [Op.lte]: new Date()
                }
            }
        });

        if (!pendingBroadcast) {
            console.log('[Worker] No pending broadcasts to send.');
            return;
        }

        // Immediately change status to 'In Progress' to lock it
        pendingBroadcast.status = 'In Progress';
        await pendingBroadcast.save();

        try {
            // 2. Query target users in the specified zone
            const userWhereClause = {
                zone_id: pendingBroadcast.zone_id,
                have_whatsapp: {
                    [Op.and]: [
                        { [Op.ne]: null },
                        { [Op.ne]: false }
                    ]
                }
            };

            // Filter by specific user list if it's not set to 'all'
            if (pendingBroadcast.notify_to == 'one_order') {
                userWhereClause.flag = 1;
            } else if (pendingBroadcast.notify_to == 'more_than_one_order') {
                userWhereClause.flag = 2;
            } else if (pendingBroadcast.notify_to == 'no_order') {
                userWhereClause.flag = 0;
            }

            const users = await User.findAll({
                where: userWhereClause,
                attributes: ['user_id', 'phone']
            });

            const phones = users.map(u => u.phone).filter(phone => phone && phone.trim() !== '');

            if (phones.length === 0) {
                console.warn(`[Worker] No active whatsapp numbers found for Broadcast ID ${pendingBroadcast.id}. Marking as Sent.`);
                pendingBroadcast.status = 'Sent';
                await pendingBroadcast.save();
                return;
            }

            // 3. Send whatsapp messages in one by one
            let successCount = 0;
            let failureCount = 0;

            phones.forEach(async (phone) => {
                let jid = `91${phone}@s.whatsapp.net`;
                if (pendingBroadcast.image) {
                    let payload = {
                        to: jid,
                        fileBuffer: pendingBroadcast.image,
                        mimeType: pendingBroadcast.mime_type,
                        caption: pendingBroadcast.caption
                    }
                    const response = await whatsappService.sendMediaMessage(payload);
                    if (response) {
                        successCount++;
                    } else {
                        failureCount++;
                    }
                } else {
                    const response = await whatsappService.sendTextMessage(jid, pendingBroadcast.caption);
                    if (response) {
                        successCount++;
                    } else {
                        failureCount++;
                    }
                }
            });

            pendingBroadcast.status = 'Sent';
            pendingBroadcast.success = successCount;
            pendingBroadcast.failed = failureCount;
            await pendingBroadcast.save();
        } catch (err) {
            console.error(`[Worker] Failed to process broadcast ID ${pendingBroadcast.id}:`, err);

            // Reset status to 'Pending' so it can retry next run
            pendingBroadcast.status = 'Pending';
            await pendingBroadcast.save();
        }
    } catch (error) {
        console.error('[Worker] Fatal error running startBroadcast:', error);
    }
}

module.exports = { startBroadcast };
