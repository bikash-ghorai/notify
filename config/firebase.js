const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../ahaari-fcm-adminsdk.json'));

initializeApp({
  credential: cert(serviceAccount)
});

module.exports = {
  getMessaging
};
