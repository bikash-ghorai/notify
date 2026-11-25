const whatsappService = require('../services/whatsappService');
const { Op } = require('sequelize');
const WaChat = require('../models/WaChat');
const WaMessage = require('../models/WaMessage');
const Zone = require('../models/Zone');

async function addZoneNames(chats) {
    const zoneIds = [...new Set(chats.flatMap(chat => chat.zone_ids || []))];
    const zones = zoneIds.length > 0
        ? await Zone.findAll({
            where: { zone_id: { [Op.in]: zoneIds } },
            attributes: ['zone_id', 'name'],
        })
        : [];
    const zoneNames = new Map(zones.map(zone => [String(zone.zone_id), zone.name]));

    return chats.map(chat => {
        const chatData = chat.toJSON();
        const names = (chatData.zone_ids || [])
            .map(zoneId => zoneNames.get(String(zoneId)))
            .filter(Boolean);

        return { ...chatData, zone_name: names.join(', ') || null };
    });
}

class WhatsappController {
    static getStatus(req, res) {
        const connected = whatsappService.getStatus();
        return res.json({ status: connected, message: connected ? 'WhatsApp is connected.' : 'WhatsApp is not connected.', data: {} });
    }

    static async getQR(req, res) {
        if (req.query.reset === 'true' || req.query.refresh === 'true') {
            await whatsappService.resetSession();
            return res.json({ status: false, message: 'Session reset initiated. Generating new QR code, please retry in 2-3 seconds.', data: {} });
        }

        const connected = whatsappService.getStatus();
        if (connected) {
            return res.json({ status: false, message: 'WhatsApp is already connected.', data: {} });
        }

        const qrImage = whatsappService.getQR();
        if (qrImage) {
            return res.json({ status: true, message: 'QR code generated.', data: { qr: qrImage } });
        }

        return res.json({ status: false, message: 'QR code not ready yet. Try again in a few seconds, or use ?reset=true to force a fresh QR.', data: {} });
    }

    static async resetSession(req, res) {
        try {
            await whatsappService.resetSession();
            return res.json({ status: true, message: 'WhatsApp session reset initiated. New QR will be generated shortly.', data: {} });
        } catch (error) {
            return res.json({ status: false, message: error.message, data: {} });
        }
    }

    // Fetch all recent chat threads ordered by last message time
    static async getChats(req, res) {
        const { zone_ids = [], limit = 10, page = 1 } = req.body;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        try {
            if (zone_ids.length > 0) {
                const chats = await WaChat.findAll({
                    where: { zone_ids: { [Op.overlap]: zone_ids } },
                    order: [['last_message_at', 'DESC']],
                    limit: parseInt(limit, 10),
                    offset: parseInt(offset, 10),
                });

                return res.json({ status: true, message: 'Chats fetched successfully.', data: await addZoneNames(chats) });
            } else {
                const chats = await WaChat.findAll({
                    limit: parseInt(limit, 10),
                    offset: parseInt(offset, 10),
                    order: [['last_message_at', 'DESC']],
                });

                return res.json({ status: true, message: 'Chats fetched successfully.', data: await addZoneNames(chats) });
            }
        } catch (error) {
            return res.json({ status: false, message: error.message, data: [] });
        }
    }

    // Fetch paginated messages for a conversation thread
    static async getChatMessages(req, res) {
        const { chatId, limit = 10, page = 1 } = req.body;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        if (!chatId) {
            return res.json({ status: false, message: 'Chat ID is required.', data: [] });
        }

        try {
            const chat = await WaChat.findOne({ where: { id: chatId } });
            if (!chat) {
                return res.json({ status: false, message: 'Chat not found.', data: [] });
            }

            const messages = await WaMessage.findAll({
                where: { chat_id: chatId },
                order: [['created_at', 'ASC']],
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
            });

            // Mark unread messages as read
            await WaChat.update({ unread_count: 0 }, { where: { id: chatId } });

            return res.json({ status: true, message: 'Messages fetched successfully.', data: { chat: chat, messages: messages } });
        } catch (error) {
            return res.json({ status: false, message: error.message, data: [] });
        }
    }

    static async sendWaMessage(req, res) {
        const { phone, text, image, mimeType } = req.body;

        if (!phone) {
            return res.json({ status: false, message: 'Parameter "phone" is required.', data: [] });
        }

        if (!text && !image) {
            return res.json({ status: false, message: 'You must provide either "text" or "image".', data: [] });
        }

        try {
            // check have whatsapp or not
            const isWhatsapp = await whatsappService.haveWhatsapp(phone);
            if (!isWhatsapp) {
                return res.json({ status: false, message: 'The provided number is not registered on WhatsApp.', data: {} });
            }

            // Check for new chat or not
            let chat = await WaChat.findOne({ where: { phone: phone } });
            let to = chat ? chat.chat_jid : `91${phone}@s.whatsapp.net`;
            if (chat) {
                // Update last message and timestamp
                let lastMessage = text ? text : image ? 'imageMessage' : '';
                await WaChat.update({
                    last_message: lastMessage,
                    last_message_at: new Date()
                }, { where: { id: chat.id } });
            } else {
                // Create a new chat room
                const user = await whatsappService.getUserInfo(phone);
                let userName = phone;
                let zonIds = [];
                if (user) {
                    userName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : phone;
                    zonIds.push(user.zone_id);
                }

                let lastMessage = text ? text : image ? 'imageMessage' : '';
                chat = await WaChat.create({
                    phone: phone,
                    name: userName,
                    last_message: lastMessage,
                    last_message_at: new Date(),
                    unread_count: 0,
                    zone_ids: zonIds
                });
            }

            if (image) {
                if (!mimeType) {
                    return res.json({ status: false, message: 'You must provide mime type for the image.', data: [] });
                }

                const result = await whatsappService.sendMediaMessage({
                    to,
                    fileBuffer: image,
                    mimeType: mimeType,
                    caption: text || '', // Safely fall back to empty string if no caption provided
                });

                // Store the media message in the database
                await WaMessage.create({
                    chat_id: chat.id,
                    message_id: result.key.id,
                    message_type: 'imageMessage',
                    message: text || '',
                    media_data: image,
                    mime_type: mimeType,
                    is_from_me: true,
                    status: 'Send'
                });

                return res.json({ status: true, message: 'Media sent successfully', data: result });
            } else {
                const result = await whatsappService.sendTextMessage(to, text);
                // console.log('Text message sent result:', result);

                // Store the text message in the database
                await WaMessage.create({
                    chat_id: chat.id,
                    message_id: result.key.id,
                    message_type: 'textMessage',
                    message: text,
                    media_data: null,
                    mime_type: null,
                    is_from_me: true,
                    status: 'Send'
                });

                return res.json({ status: true, message: 'Message sent successfully', data: result });
            }
        } catch (error) {
            console.error('Error sending message:', error.message);
            return res.json({ status: false, message: error.message, data: {} });
        }
    }

    static async getUnreadChats(req, res) {
        const { zone_ids = [], limit = 10, page = 1 } = req.body;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        try {
            if (zone_ids.length > 0) {
                const chats = await WaChat.findAll({
                    where: { zone_ids: { [Op.overlap]: zone_ids }, unread_count: { [Op.gt]: 0 } },
                    order: [['last_message_at', 'DESC']],
                    limit: parseInt(limit, 10),
                    offset: parseInt(offset, 10),
                });

                return res.json({ status: true, message: 'Chats fetched successfully.', data: chats });
            } else {
                const chats = await WaChat.findAll({
                    where: { unread_count: { [Op.gt]: 0 } },
                    limit: parseInt(limit, 10),
                    offset: parseInt(offset, 10),
                    order: [['last_message_at', 'DESC']],
                });

                return res.json({ status: true, message: 'Chats fetched successfully.', data: chats });
            }
        } catch (error) {
            return res.json({ status: false, message: error.message, data: [] });
        }
    }
}

module.exports = WhatsappController;