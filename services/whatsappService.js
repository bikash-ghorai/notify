const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const WaChat = require('../models/WaChat');
const WaMessage = require('../models/WaMessage');

let sock = null;
let isConnected = false;
let currentQR = null;
let io = null;

async function startWhatsApp(socketIoInstance = null) {
    if (socketIoInstance) {
        io = socketIoInstance;
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_session');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        syncFullHistory: true,
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // qrcodeTerminal.generate(qr, { small: true });
            try {
                currentQR = await QRCode.toDataURL(qr);
            } catch (err) {
                console.error('[WhatsApp] Failed to generate Base64 QR', err);
            }
        }

        if (connection === 'close') {
            isConnected = false;
            currentQR = null;
            if (io) io.emit('whatsapp', { status: false });

            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startWhatsApp(io);
            }
        } else if (connection === 'open') {
            isConnected = true;
            currentQR = null;
            if (io) io.emit('whatsapp', { status: true });
            console.log('✅ [WhatsApp] Connected successfully.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Inbound Messages Listener
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        // console.log(messages);

        for (const msg of messages) {
            if (msg.key.remoteJid === 'status@broadcast') continue;

            try {
                const messageData = msg.message;
                if (!messageData) continue;

                const isFromMe = Boolean(msg.key.fromMe);
                if (isFromMe) continue; // Skip processing messages sent by the bot itself

                const messageType = Object.keys(messageData)[0];
                const isMedia = ['imageMessage', 'audioMessage', 'videoMessage', 'documentMessage'].includes(messageType);
                const chatJid = msg.key.remoteJid;
                const remoteJidAlt = msg.key.remoteJidAlt ? msg.key.remoteJidAlt : chatJid;
                const phone = remoteJidAlt.split('@')[0];
                if (!phone.startsWith('91')) continue; // Skip if phone number is not available

                let mediaBase64 = null;
                let mimeType = null;
                let text = '';

                if (isMedia) {
                    const mediaBuffer = await downloadMediaMessage(
                        msg,
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }) }
                    );
                    const mediaObject = messageData[messageType];
                    mimeType = mediaObject.mimetype || 'application/octet-stream';
                    text = mediaObject.caption || '';
                    mediaBase64 = `data:${mimeType};base64,${mediaBuffer.toString('base64')}`;
                } else {
                    text = messageData.conversation || messageData.extendedTextMessage?.text || '';
                }

                // Update chat history in the database with chat id & last message & name
                const clearNumber = phone.replace('91', '');
                let chat = await WaChat.findOne({ where: { phone: clearNumber } });
                let msgType = isMedia ? messageType : 'textMessage';
                if (chat) {
                    if (!chat.chat_jid) {
                        await WaChat.update({
                            chat_jid: chatJid,
                            name: msg.pushName || ''
                        }, { where: { phone: clearNumber } });
                    }

                    await WaChat.update({
                        last_message: text || msgType || '',
                        last_message_at: new Date(),
                        unread_count: chat.unread_count + 1
                    }, { where: { phone: clearNumber } });
                } else {
                    chat = await WaChat.create({
                        chat_jid: chatJid,
                        name: msg.pushName || '',
                        phone: clearNumber,
                        last_message: text || msgType || '',
                        last_message_at: new Date(),
                        unread_count: 1,
                        zone_ids: [],
                    });
                }

                // Store the message in the database
                await WaMessage.create({
                    chat_id: chat.id,
                    message_id: msg.key.id,
                    message_type: msgType,
                    message: text,
                    media_data: mediaBase64,
                    mime_type: mimeType,
                    is_from_me: false,
                    status: 'Send'
                });

                io.emit('whatsapp', { status: 'New Message' });
            } catch (error) {
                console.error('[WhatsApp Incoming Error]:', error.message);
            }
        }
    });

    // Handle message status updates
    sock.ev.on('messages.update', async (updates) => {
        for (const { key, update } of updates) {
            if (update.status) {
                // 1 = sent, 2 = received, 3 = read, 4 = played
                console.log(`Message ${key.id} status: ${update.status}`)
                try {
                    let status = '';
                    if (update.status == 3) {
                        status = 'Delivered';
                    } else if (update.status == 4) {
                        status = 'Read';
                    } else {
                        status = 'Unknown';
                    }
                    if (status == 'Unknown' || status == '') continue; // Skip if status is unknown
                    await WaMessage.update({ status: status }, { where: { message_id: key.id }, whereNot: { status: 'Read' } });
                    io.emit('whatsapp', { status: 'Update Message Status' });
                } catch (error) {
                    console.error('Error updating message status:', error.message);
                }
            }
        }
    })
}

// Send Message
async function sendTextMessage(to, text) {
    if (!isConnected || !sock) throw new Error('WhatsApp service is disconnected');

    const result = await sock.sendMessage(to, { text });
    return result;
}

// Send Media Message
async function sendMediaMessage({ to, fileBuffer, mediaUrl, caption, mimeType, type, originalName }) {
    if (!isConnected || !sock) throw new Error('WhatsApp service is disconnected');

    const mediaSource = fileBuffer ? fileBuffer : { url: mediaUrl };

    let payload = {};
    if (type === 'image') {
        payload = { image: mediaSource, caption: caption || '' };
    } else if (type === 'audio') {
        payload = { audio: mediaSource, mimetype: mimeType || 'audio/mp4', ptt: true };
    } else if (type === 'video') {
        payload = { video: mediaSource, caption: caption || '' };
    } else {
        payload = {
            document: mediaSource,
            mimetype: mimeType || 'application/octet-stream',
            fileName: originalName || 'file',
            caption: caption || '',
        };
    }

    const result = await sock.sendMessage(to, payload);

    return result;
}

function getStatus() {
    return isConnected;
}

function getQR() {
    if (currentQR) {
        return currentQR;
    } else {
        return null;
    }
}

async function haveWhatsapp(phone) {
    const noId = `91${phone}@s.whatsapp.net`;
    const [result] = await sock.onWhatsApp(noId);
    if (result?.exists) {
        return true;
    }
    return false;
}

module.exports = {
    startWhatsApp,
    getStatus,
    getQR,
    haveWhatsapp,
    sendTextMessage,
    sendMediaMessage
};