const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const NotificationController = require('../controllers/notificationController');

// Define API routes
router.post('/sync-users', UserController.syncUsers);
router.post('/schedule-notification', NotificationController.scheduleNotification);

module.exports = router;

