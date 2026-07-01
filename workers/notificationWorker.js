const { Op } = require('sequelize');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { getMessaging } = require('../config/firebase');

async function startWorker() {
    console.log(`[Worker] Started checking for scheduled notifications at: ${new Date().toISOString()}`);
    try {
        // 1. Fetch pending notifications scheduled to be sent now or in the past
        const pendingNotifications = await Notification.findAll({
            where: {
                status: 'Pending',
                scheduled_at: {
                    [Op.lte]: new Date()
                }
            }
        });

        if (pendingNotifications.length === 0) {
            console.log('[Worker] No pending notifications to send.');
            return;
        }

        console.log(`[Worker] Found ${pendingNotifications.length} notification(s) to process.`);

        for (const notification of pendingNotifications) {
            console.log(`[Worker] Processing notification ID: ${notification.id} - "${notification.title}"`);

            // Immediately change status to 'In Progress' to lock it
            notification.status = 'In Progress';
            await notification.save();

            try {
                // 2. Query target users in the specified zone
                const userWhereClause = {
                    zone_id: notification.zone_id,
                    fcm_token: {
                        [Op.and]: [
                            { [Op.ne]: null },
                            { [Op.ne]: '' }
                        ]
                    }
                };

                // Filter by specific user list if it's not set to 'all'
                if (notification.notify_to && notification.notify_to == 'one_order') {
                    userWhereClause.flag = 1;
                } else if (notification.notify_to && notification.notify_to == 'more_than_one_order') {
                    userWhereClause.flag = 2;
                } else if (notification.notify_to && notification.notify_to == 'no_order') {
                    userWhereClause.flag = 0;
                }

                const users = await User.findAll({
                    where: userWhereClause,
                    attributes: ['user_id', 'fcm_token']
                });

                const tokens = users.map(u => u.fcm_token).filter(token => token && token.trim() !== '');

                if (tokens.length === 0) {
                    console.warn(`[Worker] No active FCM tokens found for Notification ID ${notification.id}. Marking as Sent.`);
                    notification.status = 'Sent';
                    await notification.save();
                    continue;
                }

                console.log(`[Worker] Sending to ${tokens.length} FCM token(s) for Notification ID ${notification.id}...`);

                // 3. Send notifications in batches of 500 (FCM limit for multicast)
                const messaging = getMessaging();
                const batchSize = 500;
                let successCount = 0;
                let failureCount = 0;

                for (let i = 0; i < tokens.length; i += batchSize) {
                    const batchTokens = tokens.slice(i, i + batchSize);
                    const message = {
                        notification: {
                            title: notification.title,
                            body: notification.body
                        },
                        tokens: batchTokens
                    };

                    const response = await messaging.sendEachForMulticast(message);
                    successCount += response.successCount;
                    failureCount += response.failureCount;
                }

                console.log(`[Worker] Notification ID ${notification.id} completed. Successes: ${successCount}, Failures: ${failureCount}`);

                notification.status = 'Sent';
                notification.success = successCount;
                notification.failed = failureCount;
                await notification.save();
            } catch (err) {
                console.error(`[Worker] Failed to process notification ID ${notification.id}:`, err);

                // Reset status to 'Pending' so it can retry next run
                notification.status = 'Pending';
                await notification.save();
            }
        }
    } catch (error) {
        console.error('[Worker] Fatal error running startWorker:', error);
    }
}

module.exports = { startWorker };
