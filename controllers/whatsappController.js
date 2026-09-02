const whatsappService = require('../services/whatsappService');
const WaChat = require('../models/WaChat');
const WaMessage = require('../models/WaMessage');
const User = require('../models/User');

class WhatsappController {
    static getStatus(req, res) {
        const connected = whatsappService.getStatus();
        return res.json({ status: connected, message: connected ? 'WhatsApp is connected.' : 'WhatsApp is not connected.', data: {} });
    }

    static getQR(req, res) {
        const connected = whatsappService.getStatus();
        const qrImage = whatsappService.getQR();

        if (connected) {
            return res.json({ status: false, message: 'WhatsApp is already connected.', data: {} });
        }

        if (qrImage) {
            return res.json({ status: true, message: 'QR code generated.', data: { qr: qrImage } });
        }

        return res.json({ status: false, message: 'QR code not ready yet. Try again in a few seconds.', data: {} });
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

                return res.json({ status: true, message: 'Chats fetched successfully.', data: chats });
            } else {
                const chats = await WaChat.findAll({
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

    // Fetch paginated messages for a conversation thread
    static async getChatMessages(req, res) {
        const { chatId, limit = 10, page = 1 } = req.body;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        if (!chatId) {
            return res.json({ status: false, message: 'Chat ID is required.', data: [] });
        }

        try {
            const messages = await WaMessage.findAll({
                where: { chat_id: chatId },
                order: [['timestamp', 'ASC']],
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
            });

            // Mark unread messages as read
            await WaChat.update({ unread_count: 0 }, { where: { chat_id: chatId } });

            return res.json({ status: true, message: 'Messages fetched successfully.', data: messages });
        } catch (error) {
            return res.status(500).json({ status: false, message: error.message, data: [] });
        }
    }

    static async sendWaMessage(req, res) {
        const { phone, text, mediaUrl, type } = req.body;

        if (!phone) {
            return res.json({ status: false, message: 'Parameter "phone" is required.', data: [] });
        }

        if (!text && !mediaUrl && !req.file) {
            return res.json({ status: false, message: 'You must provide either "text", "mediaUrl", or a file upload.', data: [] });
        }

        try {
            // Check for new chat or not
            const chat = await WaChat.findOne({ where: { phone: phone } });
            let to = chat ? chat.chat_id : `91${phone}@s.whatsapp.net`;
            if (!chat) {
                // check have whatsapp or not
                const isWhatsapp = await whatsappService.haveWhatsapp(to);
                if (!isWhatsapp) {
                    return res.json({ status: false, message: 'The provided number is not registered on WhatsApp.', data: {} });
                }
            }

            if (mediaUrl || req.file) {
                const resolvedType = type || (req.file?.mimetype.startsWith('image/') ? 'image' : 'document');

                const result = await whatsappService.sendMediaMessage({
                    to,
                    fileBuffer: req.file ? req.file.buffer : null,
                    mediaUrl,
                    caption: text || '', // Safely fall back to empty string if no caption provided
                    mimeType: req.file ? req.file.mimetype : null,
                    type: resolvedType,
                    originalName: req.file ? req.file.originalname : 'file'
                });

                // Create a new chat
                // await WaChat.create({ chat_id: result.key.id, phone: to, last_message: text || mediaUrl || req.file?.originalname || '', last_message_at: new Date() });

                // Store the media message in the database
                // await WaMessage.create({
                //     id: messageId,
                //     chat_jid: to,
                //     sender_jid: 'me',
                //     sender_name: 'Agent',
                //     message_type: `${type}Message`,
                //     text: text || '',
                //     media_data: mediaUrl || (file ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}` : ''),
                //     mime_type: file ? file.mimetype : null,
                //     is_from_me: true,
                //     status: 'sent',
                //     timestamp: Math.floor(Date.now() / 1000),
                // });

                return res.json({ status: true, message: 'Media sent successfully', messageId: {} });
            } else {
                const result = await whatsappService.sendTextMessage(to, text);
                console.log('Text message sent result:', result);

                // Store the text message in the database
                // await storeMessageInDB(to, text, null, null, 'text', result.key.id);

                return res.json({ status: true, message: 'Message sent successfully', messageId: {} });
            }
        } catch (error) {
            return res.status(500).json({ status: false, message: error.message });
        }
    }
}

module.exports = WhatsappController;