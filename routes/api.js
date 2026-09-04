const express = require('express');
const router = express.Router();

const UserController = require('../controllers/userController');
const NotificationController = require('../controllers/notificationController');
const SocketController = require('../controllers/socketController');
const AnalyticController = require('../controllers/analyticController');
const WhatsappController = require('../controllers/whatsappController');
const BroadcastController = require('../controllers/broadcastController');

// Define API routes
router.post('/sync-users', UserController.syncUsers);
router.post('/user-devices', UserController.userDevices);

router.post('/notifications', NotificationController.list);
router.post('/notification/create', NotificationController.create);
router.post('/notification/update', NotificationController.update);
router.get('/notification/:id', NotificationController.edit);
router.post('/notification/delete', NotificationController.delete);

// For Socket
router.post('/send-message', SocketController.sendMessage);
router.post('/send-message-to-all', SocketController.sendMessageToAll);

// For Analytics
router.post('/analytics', AnalyticController.analytics);
router.get('/analytics/:id', AnalyticController.analyticsBySessionId);
router.post('/analytics/add-to-cart', AnalyticController.addToCart);

// For WhatsApp
router.get('/whatsapp/status', WhatsappController.getStatus);
router.get('/whatsapp/qr', WhatsappController.getQR);
router.get('/whatsapp/reset', WhatsappController.resetSession);
router.post('/whatsapp/chats', WhatsappController.getChats);
router.post('/whatsapp/chats/messages', WhatsappController.getChatMessages);
router.post('/whatsapp/send', WhatsappController.sendWaMessage);

// For WhatsApp Broadcast
router.post('/broadcasts', BroadcastController.list);
router.post('/broadcast/create', BroadcastController.create);
router.post('/broadcast/update', BroadcastController.update);
router.get('/broadcast/:id', BroadcastController.edit);
router.post('/broadcast/delete', BroadcastController.delete);

module.exports = router;

