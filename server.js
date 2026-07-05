require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const { startWorker } = require('./workers/notificationWorker');
const AnalyticController = require('./controllers/analyticController');
const redisClient = require('./config/redis');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.set('io', io);

app.use((request, response, next) => {
    if (request.method === 'POST') {
        const token = request.headers['s-access-token'];
        if (token == process.env.AUTH_TOKEN) {
            next();
        } else {
            response.json({ status: false, message: 'Authentication Failed', data: {} });
        }
    } else {
        next();
    }
});

io.on('connection', (socket) => {
    console.log('A user connected');

    // Register a new user
    socket.on('register', async (userId, callback) => {
        try {
            await redisClient.set(`user:socket:${userId}`, socket.id);
            await redisClient.set(`socket:user:${socket.id}`, userId);
            await redisClient.sAdd('active_users', userId);

            const count = await redisClient.sCard('active_users');
            io.emit('activeUser', { count });

            if (typeof callback === 'function') {
                callback({ status: true, message: 'User registered successfully', data: socket.id });
            }
        } catch (error) {
            console.error('Error registering user in Redis:', error.message);
            if (typeof callback === 'function') {
                callback({ status: false, message: error.message });
            }
        }
    });

    // Handle incoming analytics
    socket.on('analytics', async (data, callback) => {
        const socketId = socket.id;
        console.log('socketId', socketId);
        console.log('emit data', data);
        try {
            if (data && data.session_id) {
                await redisClient.set(`socket:session:${socketId}`, data.session_id);
                await redisClient.set(`session:socket:${data.session_id}`, socketId);
                await redisClient.sAdd('active_sessions', data.session_id);
            }
            const analytics = await AnalyticController.saveAnalytics(data);
            if (typeof callback === 'function') {
                callback({ status: true, message: 'Analytics synced successfully', data: analytics });
            }
        } catch (error) {
            console.error('Error saving socket analytics:', error.message);
            if (typeof callback === 'function') {
                callback({ status: false, message: error.message });
            }
        }
    });

    socket.on('disconnect', async () => {
        console.log('A user disconnected');
        try {
            const userId = await redisClient.get(`socket:user:${socket.id}`);
            if (userId) {
                await redisClient.del(`user:socket:${userId}`);
                await redisClient.del(`socket:user:${socket.id}`);
                await redisClient.sRem('active_users', userId);
            }

            const sessionId = await redisClient.get(`socket:session:${socket.id}`);
            if (sessionId) {
                await redisClient.del(`socket:session:${socket.id}`);
                await redisClient.del(`session:socket:${sessionId}`);
                await redisClient.sRem('active_sessions', sessionId);
            }

            const count = await redisClient.sCard('active_users');
            io.emit('activeUser', { count });
        } catch (error) {
            console.error('Error handling disconnect in Redis:', error.message);
        }
    });
});

app.get('/', (req, res) => {
    res.send("Notification microservice is running.");
});

app.use('/api', apiRoutes);

// Cron task
cron.schedule('*/5 * * * *', () => {
    startWorker();
    console.log('Automated task executed at:', new Date().toLocaleTimeString());
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// 5. Start the HTTP server (instead of app.listen)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Notification microservice is running on port ${PORT}`);
});

module.exports = { io };
