const { Op } = require('sequelize');
const WaBroadcast = require('../models/WaBroadcast');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let isWorkerRunning = false;

// Helper: Wait for WhatsApp connection to recover if temporarily disconnected
async function waitForConnection(maxWaitSeconds = 60) {
    let waited = 0;
    while (!whatsappService.getStatus() && waited < maxWaitSeconds) {
        console.log(`[Worker] WhatsApp disconnected. Waiting for reconnection... (${waited}s / ${maxWaitSeconds}s)`);
        await delay(3000);
        waited += 3;
    }
    return whatsappService.getStatus();
}

async function startBroadcast() {
    console.log(`[Worker] Started checking for scheduled broadcasts at: ${new Date().toISOString()}`);

    // Prevent concurrent runs from overlapping cron cycles
    if (isWorkerRunning) {
        console.log('[Worker] A broadcast task is already running. Skipping this cycle.');
        return;
    }

    isWorkerRunning = true;

    try {
        // 1. Check if WhatsApp is connected before starting
        if (!whatsappService.getStatus()) {
            console.warn('[Worker] WhatsApp is not connected. Postponing broadcast check.');
            return;
        }

        // 2. Fetch pending or in-progress broadcast scheduled to be sent now or in the past
        const pendingBroadcast = await WaBroadcast.findOne({
            where: {
                status: {
                    [Op.in]: ['Pending', 'In Progress']
                },
                scheduled_at: {
                    [Op.lte]: new Date()
                }
            },
            order: [['scheduled_at', 'ASC']]
        });

        if (!pendingBroadcast) {
            console.log('[Worker] No pending broadcasts to send.');
            return;
        }

        // Lock status to 'In Progress'
        if (pendingBroadcast.status !== 'In Progress') {
            pendingBroadcast.status = 'In Progress';
            await pendingBroadcast.save();
        }

        const lastProcessedId = pendingBroadcast.last_user_id || 0;

        try {
            // 3. Query target users in the specified zone AFTER the last processed ID (checkpoint)
            const userWhereClause = {
                zone_id: pendingBroadcast.zone_id,
                id: { [Op.gt]: lastProcessedId },
                [Op.or]: [
                    { have_whatsapp: null },
                    { have_whatsapp: { [Op.ne]: false } }
                ]
            };

            // Filter by specific user flag if not 'all'
            if (pendingBroadcast.notify_to === 'one_order') {
                userWhereClause.flag = 1;
            } else if (pendingBroadcast.notify_to === 'more_than_one_order') {
                userWhereClause.flag = 2;
            } else if (pendingBroadcast.notify_to === 'no_order') {
                userWhereClause.flag = 0;
            }

            const users = await User.findAll({
                where: userWhereClause,
                attributes: ['id', 'user_id', 'phone', 'have_whatsapp', 'status', 'zone_id', 'flag'],
                order: [['id', 'ASC']]
            });

            if (users.length === 0) {
                console.log(`[Worker] All users processed for Broadcast ID ${pendingBroadcast.id}. Marking as Sent.`);
                pendingBroadcast.status = 'Sent';
                await pendingBroadcast.save();
                return;
            }

            console.log(`[Worker] Resuming Broadcast ID ${pendingBroadcast.id} from user ID > ${lastProcessedId}. Target users: ${users.length}`);

            let successCount = pendingBroadcast.success || 0;
            let failureCount = pendingBroadcast.failed || 0;
            let currentCheckpointId = lastProcessedId;

            for (const user of users) {
                // Check if WhatsApp session is still alive before sending to this user
                if (!whatsappService.getStatus()) {
                    console.warn(`[Worker] WhatsApp disconnected. Attempting to wait for auto-reconnect...`);
                    const reconnected = await waitForConnection(60);
                    if (!reconnected) {
                        console.error(`[Worker] WhatsApp session unavailable. Pausing Broadcast ID ${pendingBroadcast.id} at user ID ${currentCheckpointId}.`);
                        pendingBroadcast.last_user_id = currentCheckpointId;
                        pendingBroadcast.success = successCount;
                        pendingBroadcast.failed = failureCount;
                        pendingBroadcast.status = 'Pending';
                        await pendingBroadcast.save();
                        return;
                    }
                }

                const phone = user.phone ? user.phone.replace(/[^0-9]/g, '') : '';
                if (phone.length !== 10) {
                    currentCheckpointId = user.id;
                    continue; // Skip invalid phone numbers
                }

                // Verify whether the number is registered on WhatsApp
                if (user.have_whatsapp === null) {
                    try {
                        const haveWhatsapp = await whatsappService.haveWhatsapp(phone);
                        user.have_whatsapp = !!haveWhatsapp;
                        await user.save();

                        if (!haveWhatsapp) {
                            currentCheckpointId = user.id;
                            continue; // Skip without aborting the loop
                        }
                    } catch (checkErr) {
                        console.error(`[Worker] Error checking WhatsApp status for ${phone}:`, checkErr.message);

                        if (!whatsappService.getStatus()) {
                            console.error('[Worker] Disconnected during haveWhatsapp check. Saving checkpoint and pausing.');
                            pendingBroadcast.last_user_id = currentCheckpointId;
                            pendingBroadcast.success = successCount;
                            pendingBroadcast.failed = failureCount;
                            pendingBroadcast.status = 'Pending';
                            await pendingBroadcast.save();
                            return;
                        }

                        currentCheckpointId = user.id;
                        continue;
                    }
                }

                if (user.have_whatsapp) {
                    const jid = `91${phone}@s.whatsapp.net`;
                    try {
                        if (pendingBroadcast.image) {
                            const payload = {
                                to: jid,
                                fileBuffer: pendingBroadcast.image,
                                mimeType: pendingBroadcast.mime_type,
                                caption: pendingBroadcast.caption
                            };
                            await whatsappService.sendMediaMessage(payload);
                        } else {
                            await whatsappService.sendTextMessage(jid, pendingBroadcast.caption);
                        }
                        successCount++;
                    } catch (sendErr) {
                        console.error(`[Worker] Failed sending message to ${phone}:`, sendErr.message);
                        failureCount++;

                        // If the send failed because the connection dropped mid-send
                        if (!whatsappService.getStatus()) {
                            console.error(`[Worker] WhatsApp session disconnected during message send. Pausing broadcast.`);
                            // Note: We don't advance currentCheckpointId to user.id because this user failed due to disconnect
                            pendingBroadcast.last_user_id = currentCheckpointId;
                            pendingBroadcast.success = successCount;
                            pendingBroadcast.failed = failureCount;
                            pendingBroadcast.status = 'Pending';
                            await pendingBroadcast.save();
                            return;
                        }
                    }

                    currentCheckpointId = user.id;

                    // Periodic checkpoint save every 5 messages
                    if ((successCount + failureCount) % 5 === 0) {
                        pendingBroadcast.last_user_id = currentCheckpointId;
                        pendingBroadcast.success = successCount;
                        pendingBroadcast.failed = failureCount;
                        await pendingBroadcast.save();
                    }

                    // Anti-spam delay between messages (2.5s - 4.5s randomized)
                    await delay(2500 + Math.floor(Math.random() * 2000));
                } else {
                    currentCheckpointId = user.id;
                }
            }

            // Loop finished: mark as Sent
            pendingBroadcast.status = 'Sent';
            pendingBroadcast.last_user_id = currentCheckpointId;
            pendingBroadcast.success = successCount;
            pendingBroadcast.failed = failureCount;
            await pendingBroadcast.save();

            console.log(`[Worker] Broadcast ID ${pendingBroadcast.id} completed. Success: ${successCount}, Failed: ${failureCount}`);
        } catch (err) {
            console.error(`[Worker] Error during broadcast execution ID ${pendingBroadcast.id}:`, err);

            // Save progress and set back to 'Pending' so it can resume on next cycle
            pendingBroadcast.status = 'Pending';
            pendingBroadcast.last_user_id = currentCheckpointId;
            pendingBroadcast.success = successCount;
            pendingBroadcast.failed = failureCount;
            await pendingBroadcast.save();
        }
    } catch (error) {
        console.error('[Worker] Fatal error in startBroadcast:', error);
    } finally {
        isWorkerRunning = false;
    }
}

module.exports = { startBroadcast };
