const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const NotificationController = require('../controllers/notificationController');

// Define API routes
router.post('/sync-users', UserController.syncUsers);
router.post('/notifications', NotificationController.list);
router.post('/notification/create', NotificationController.create);
router.post('/notification/update', NotificationController.update);
router.get('/notification/:id', NotificationController.edit);
router.post('/notification/delete', NotificationController.delete);

module.exports = router;

