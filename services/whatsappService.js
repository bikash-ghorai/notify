const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');

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

            // const statusCode = lastDisconnect?.error?.output?.statusCode;
            // const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            // if (shouldReconnect) {
            //     startWhatsApp(io);
            // }
        } else if (connection === 'open') {
            isConnected = true;
            currentQR = null;
            if (io) io.emit('whatsapp', { status: true });
            console.log('✅ [WhatsApp] Connected successfully.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Initial History Sync from WhatsApp
    // sock.ev.on('messaging-history.set', async ({ chats, messages }) => {
    //     try {
    //         console.log(`[WhatsApp] Syncing history: ${chats?.length || 0} chats, ${messages?.length || 0} messages.`);

    //         if (chats) {
    //             for (const chat of chats) {
    //                 const phone = chat.id.split('@')[0];
    //                 await WaChat.upsert({
    //                     jid: chat.id,
    //                     name: chat.name || phone,
    //                     phone: phone,
    //                     last_message: '',
    //                     last_message_at: chat.conversationTimestamp ? new Date(chat.conversationTimestamp * 1000) : new Date(),
    //                 });
    //             }
    //         }

    //         if (messages) {
    //             for (const msg of messages) {
    //                 if (msg.key.remoteJid === 'status@broadcast') continue;
    //                 const messageData = msg.message;
    //                 if (!messageData) continue;

    //                 const messageType = Object.keys(messageData)[0];
    //                 const text = messageData.conversation || messageData.extendedTextMessage?.text || messageData[messageType]?.caption || '';
    //                 const chatJid = msg.key.remoteJid;
    //                 const phone = chatJid.split('@')[0];

    //                 await WaMessage.findOrCreate({
    //                     where: { id: msg.key.id },
    //                     defaults: {
    //                         id: msg.key.id,
    //                         chat_jid: chatJid,
    //                         sender_jid: msg.key.participant || chatJid,
    //                         sender_name: msg.pushName || phone,
    //                         message_type: messageType,
    //                         text: text,
    //                         is_from_me: msg.key.fromMe ? true : false,
    //                         status: 'delivered',
    //                         timestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000),
    //                     },
    //                 });
    //             }
    //         }
    //     } catch (error) {
    //         console.error('[WhatsApp History Sync Error]:', error.message);
    //     }
    // });

    // Inbound Messages Listener
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        console.log(messages);

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
                const chatNoId = msg.key.remoteJidAlt ? msg.key.remoteJidAlt.split('@')[0] : chatJid.split('@')[0];
                const phone = chatJid.split('@')[0];
                const senderName = msg.pushName || phone;

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

                const timestamp = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000);
                const messageDate = new Date(timestamp * 1000);

                // // 1. Upsert Chat Thread in Sequelize
                // await WaChat.upsert({
                //     jid: chatJid,
                //     name: senderName,
                //     phone: phone,
                //     last_message: text || (isMedia ? `[${messageType}]` : ''),
                //     last_message_at: messageDate,
                // });

                // if (!isFromMe) {
                //     await WaChat.increment('unread_count', { by: 1, where: { jid: chatJid } });
                // }

                // // 2. Insert Message into Sequelize
                // await WaMessage.findOrCreate({
                //     where: { id: msg.key.id },
                //     defaults: {
                //         id: msg.key.id,
                //         chat_jid: chatJid,
                //         sender_jid: msg.key.participant || chatJid,
                //         sender_name: senderName,
                //         message_type: messageType,
                //         text: text,
                //         media_data: mediaBase64,
                //         mime_type: mimeType,
                //         is_from_me: isFromMe,
                //         status: 'delivered',
                //         timestamp: timestamp,
                //     },
                // });

                // // 3. Emit via Socket.IO for live UI updates
                // if (io) {
                //     io.emit('whatsapp', {
                //         type: 'incoming',
                //         message_id: msg.key.id,
                //         chat_jid: chatJid,
                //         sender_jid: msg.key.participant || chatJid,
                //         sender_name: senderName,
                //         text: text,
                //         has_media: isMedia,
                //         media: mediaBase64,
                //         mime_type: mimeType,
                //         is_from_me: isFromMe,
                //         timestamp: timestamp,
                //         created_at: messageDate.toISOString(),
                //     });
                // }
            } catch (error) {
                console.error('[WhatsApp Incoming Error]:', error.message);
            }
        }
    });
}

// // Send Message
// async function sendMessage(phone, text) {
//     // Correct: country code + digits only, no symbols
//     const noId = `91${phone}@s.whatsapp.net`;

//     // Verify the number exists on WhatsApp before messaging
//     const [result] = await sock.onWhatsApp(noId);
//     if (result?.exists) {
//         let jid = result.jid;
//         const sentMessage = await sock.sendMessage(jid, { text });

//         const now = new Date();
//         await WaChat.upsert({
//             jid,
//             phone: phone,
//             last_message: text,
//             last_message_at: now,
//         });

//         await WaMessage.create({
//             id: result.key.id,
//             chat_jid: jid,
//             sender_jid: 'me',
//             sender_name: 'Agent',
//             message_type: 'conversation',
//             text: text,
//             is_from_me: true,
//             status: 'sent',
//             timestamp: timestamp,
//         });
//         return { success: true, message: 'Message sent successfully.', data: sentMessage };
//     } else {
//         return { success: false, message: `The number ${phone} is not registered on WhatsApp.` };
//     }
// }

// async function sendTextMessage(to, text) {
//     if (!isConnected || !sock) throw new Error('WhatsApp service is disconnected');

//     const cleanNumber = to.replace(/\D/g, '');
//     const jid = to.includes('@s.whatsapp.net') ? to : `${cleanNumber}@s.whatsapp.net`;
//     const result = await sock.sendMessage(jid, { text });

//     const timestamp = Math.floor(Date.now() / 1000);
//     const now = new Date();

//     await WaChat.upsert({
//         jid,
//         phone: cleanNumber,
//         last_message: text,
//         last_message_at: now,
//     });

//     await WaMessage.create({
//         id: result.key.id,
//         chat_jid: jid,
//         sender_jid: 'me',
//         sender_name: 'Agent',
//         message_type: 'conversation',
//         text: text,
//         is_from_me: true,
//         status: 'sent',
//         timestamp: timestamp,
//     });

//     return result;
// }

// // Send Media Message
// async function sendMediaMessage({ to, fileBuffer, mediaUrl, caption, mimeType, type, originalName }) {
//     if (!isConnected || !sock) throw new Error('WhatsApp service is disconnected');

//     const cleanNumber = to.replace(/\D/g, '');
//     const jid = to.includes('@s.whatsapp.net') ? to : `${cleanNumber}@s.whatsapp.net`;
//     const mediaSource = fileBuffer ? fileBuffer : { url: mediaUrl };

//     let payload = {};
//     if (type === 'image') {
//         payload = { image: mediaSource, caption: caption || '' };
//     } else if (type === 'audio') {
//         payload = { audio: mediaSource, mimetype: mimeType || 'audio/mp4', ptt: true };
//     } else if (type === 'video') {
//         payload = { video: mediaSource, caption: caption || '' };
//     } else {
//         payload = {
//             document: mediaSource,
//             mimetype: mimeType || 'application/octet-stream',
//             fileName: originalName || 'file',
//             caption: caption || '',
//         };
//     }

//     const result = await sock.sendMessage(jid, payload);
//     const timestamp = Math.floor(Date.now() / 1000);
//     const now = new Date();
//     const mediaBase64 = fileBuffer ? `data:${mimeType};base64,${fileBuffer.toString('base64')}` : mediaUrl;

//     await WaChat.upsert({
//         jid,
//         phone: cleanNumber,
//         last_message: caption || `[${type}]`,
//         last_message_at: now,
//     });

//     await WaMessage.create({
//         id: result.key.id,
//         chat_jid: jid,
//         sender_jid: 'me',
//         sender_name: 'Agent',
//         message_type: `${type}Message`,
//         text: caption || '',
//         media_data: mediaBase64,
//         mime_type: mimeType,
//         is_from_me: true,
//         status: 'sent',
//         timestamp: timestamp,
//     });

//     return result;
// }

function getStatus() {
    return isConnected;
}

function getQR() {
    if (currentQR) {
        return currentQR;
    } else {
        startWhatsApp(io);
        throw new Error('QR code is not available. Please ensure WhatsApp is not connected.');
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
};