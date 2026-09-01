const whatsappService = require('../services/whatsappService');
const { WaChat, WaMessage } = require('../models');

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

                return res.json({ status: true, message: 'Media sent successfully', messageId: result.key.id });
            } else {
                const result = await whatsappService.sendTextMessage(to, text);
                return res.json({ status: true, message: 'Message sent successfully', messageId: result.key.id });
            }
            
        } catch (error) {
            return res.status(500).json({ status: false, message: error.message });
        }
    }
}

module.exports = WhatsappController;