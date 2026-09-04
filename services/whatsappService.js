const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadMediaMessage,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
// let qrcodeTerminal = null;
// try {
//     qrcodeTerminal = require('qrcode-terminal');
// } catch (e) {
//     qrcodeTerminal = null;
// }
const path = require('path');
const fs = require('fs');
const WaChat = require('../models/WaChat');
const WaMessage = require('../models/WaMessage');

const AUTH_DIR = path.resolve(__dirname, '../auth_session');

let sock = null;
let isConnected = false;
let currentQR = null;
let io = null;
let reconnectTimer = null;

async function startWhatsApp(socketIoInstance = null) {
    if (socketIoInstance) {
        io = socketIoInstance;
    }

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    try {
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        let version;
        try {
            const { version: latestVersion } = await fetchLatestBaileysVersion();
            version = latestVersion;
        } catch (verErr) {
            console.warn('[WhatsApp] Could not fetch latest Baileys version, using default:', verErr.message);
        }

        if (sock) {
            try {
                sock.ev.removeAllListeners();
                sock.end(undefined);
            } catch (e) { }
            sock = null;
        }

        sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: Browsers ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '20.0.04'],
            syncFullHistory: true,
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('[WhatsApp] QR code generated. Scan this with WhatsApp:');
                // if (qrcodeTerminal) {
                //     try {
                //         qrcodeTerminal.generate(qr, { small: true });
                //     } catch (e) { }
                // }
                try {
                    currentQR = await QRCode.toDataURL(qr);
                    if (io) {
                        io.emit('whatsapp', { status: 'QR', qr: currentQR });
                    }
                } catch (err) {
                    console.error('[WhatsApp] Failed to generate Base64 QR', err);
                }
            }

            if (connection === 'close') {
                isConnected = false;
                currentQR = null;

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message;
                console.warn(`[WhatsApp] Connection closed. Code: ${statusCode}, Reason: ${errorMessage || 'Unknown'}`);

                const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
                const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;

                if (io) {
                    io.emit('whatsapp', { status: isLoggedOut ? 'Logged Out' : 'Disconnected' });
                }

                if (isLoggedOut) {
                    console.log('[WhatsApp] Logged out or session expired. Clearing auth_session to generate new QR...');
                    try {
                        if (fs.existsSync(AUTH_DIR)) {
                            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                        }
                    } catch (fsErr) {
                        console.error('[WhatsApp] Failed to delete auth_session folder:', fsErr.message);
                    }
                    // Generate new QR quickly after logout
                    reconnectTimer = setTimeout(() => {
                        startWhatsApp(io);
                    }, 2000);
                } else if (isRestartRequired) {
                    // Code 515: Baileys stream restart required right after scan/connect - reconnect immediately
                    console.log('[WhatsApp] Stream restart required (Code 515). Reconnecting immediately...');
                    reconnectTimer = setTimeout(() => {
                        startWhatsApp(io);
                    }, 1000);
                } else {
                    console.log('[WhatsApp] Temporary disconnect. Reconnecting in 5 seconds...');
                    reconnectTimer = setTimeout(() => {
                        startWhatsApp(io);
                    }, 5000);
                }
            } else if (connection === 'open') {
                isConnected = true;
                currentQR = null;
                if (io) io.emit('whatsapp', { status: 'Logged In' });
                console.log('✅ [WhatsApp] Connected successfully.');
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (err) {
        console.error('[WhatsApp] Failed to start WhatsApp socket:', err);
    }

    // Inbound Messages Listener
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

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
                } else if (messageData.conversation || messageData.extendedTextMessage?.text) {
                    text = messageData.conversation || messageData.extendedTextMessage?.text || '';
                } else {
                    continue; // Skip if message type is not supported
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
                // console.log(`Message ${key.id} status: ${update.status}`)
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
function normalizeMediaData(fileBuffer) {
    if (Buffer.isBuffer(fileBuffer)) {
        return fileBuffer;
    }

    if (fileBuffer instanceof Uint8Array) {
        return Buffer.from(fileBuffer);
    }

    if (typeof fileBuffer === 'string') {
        const dataUrlMatch = fileBuffer.match(/^data:[^;]+;base64,(.+)$/s);
        const base64Data = dataUrlMatch ? dataUrlMatch[1] : fileBuffer;

        if (dataUrlMatch || /^[A-Za-z0-9+/\s]+=*$/.test(base64Data)) {
            return Buffer.from(base64Data.replace(/\s/g, ''), 'base64');
        }
    }

    throw new Error('Media must be a Buffer, Uint8Array, or base64-encoded data URL.');
}

async function sendMediaMessage({ to, fileBuffer, mimeType, caption }) {
    if (!isConnected || !sock) throw new Error('WhatsApp service is disconnected');

    const mediaData = normalizeMediaData(fileBuffer);
    let payload = { image: mediaData, caption: caption || '', mimetype: mimeType };

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

async function resetSession() {
    console.log('[WhatsApp] Manually resetting WhatsApp session...');
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (sock) {
        try {
            sock.ev.removeAllListeners();
            sock.end(undefined);
        } catch (e) { }
        sock = null;
    }

    isConnected = false;
    currentQR = null;

    try {
        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
    } catch (e) {
        console.error('[WhatsApp] Failed to delete auth_session folder:', e.message);
    }

    if (io) {
        io.emit('whatsapp', { status: false, message: 'Session reset' });
    }

    console.log('[WhatsApp] Session cleared. Starting fresh socket for new QR code...');
    await startWhatsApp(io);
}

module.exports = {
    startWhatsApp,
    getStatus,
    getQR,
    resetSession,
    haveWhatsapp,
    sendTextMessage,
    sendMediaMessage
};