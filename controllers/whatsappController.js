const whatsappService = require('../services/whatsappService');
const WaChat = require('../models/WaChat');
const WaMessage = require('../models/WaMessage');
const User = require('../models/User');

class WhatsappController {
    static getStatus(req, res) {
        const connected = whatsappService.getStatus();
        return res.json({ status: true, connected });
    }

    static getQR(req, res) {
        const connected = whatsappService.getStatus();
        const qrImage = whatsappService.getQR();

        if (connected) {
            return res.json({ status: true, connected: true, message: 'WhatsApp is already connected.' });
        }

        if (qrImage) {
            return res.json({ status: true, connected: false, qr: qrImage });
        }

        return res.json({ status: false, connected: false, message: 'QR code not ready yet. Try again in a few seconds.' });
    }

    // Fetch all recent chat threads ordered by last message time
    static async getChats(req, res) {
        try {
            const chats = await WaChat.findAll({
                order: [['last_message_at', 'DESC']],
            });
            return res.json({ status: true, data: chats });
        } catch (error) {
            return res.status(500).json({ status: false, message: error.message });
        }
    }

    // Fetch paginated messages for a conversation thread
    static async getChatMessages(req, res) {
        const { jid } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        if (!jid) {
            return res.status(422).json({ status: false, message: 'Chat JID is required.' });
        }

        try {
            const messages = await WaMessage.findAll({
                where: { chat_jid: jid },
                order: [['timestamp', 'ASC']],
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
            });

            // Mark unread messages as read
            await WaChat.update({ unread_count: 0 }, { where: { jid } });

            return res.json({ status: true, data: messages });
        } catch (error) {
            return res.status(500).json({ status: false, message: error.message });
        }
    }

    static async sendWaMessage(req, res) {
        const { to, text, mediaUrl, type } = req.body;

        if (!to) {
            return res.status(422).json({ status: false, message: 'Parameter "to" is required.' });
        }

        if (!text && !mediaUrl && !req.file) {
            return res.status(422).json({ status: false, message: 'You must provide either "text", "mediaUrl", or a file upload.' });
        }

        try {
            // Check for new chat or not
            const chat = await WaChat.findOne({ where: { phone: to } });
            if (!chat) {
                // check have whatsapp or not
                const isWhatsapp = await whatsappService.haveWhatsapp(to);
                if (!isWhatsapp) {
                    return res.json({ status: false, message: 'The provided number is not registered on WhatsApp.', data: {} });
                }
                // Create a new chat
                await WaChat.create({ chat_id: uniqueId(), phone: to, last_message: text || mediaUrl || req.file?.originalname || '', last_message_at: new Date() });
            }

            if (mediaUrl || req.file) {
                const resolvedType = type || (req.file?.mimetype.startsWith('image/') ? 'image' : 'document');

                // const result = await whatsappService.sendMediaMessage({
                //     to,
                //     fileBuffer: req.file ? req.file.buffer : null,
                //     mediaUrl,
                //     caption: text || '', // Safely fall back to empty string if no caption provided
                //     mimeType: req.file ? req.file.mimetype : null,
                //     type: resolvedType,
                //     originalName: req.file ? req.file.originalname : 'file'
                // });

                // // Store the media message in the database
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
                // const result = await whatsappService.sendTextMessage(to, text);

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