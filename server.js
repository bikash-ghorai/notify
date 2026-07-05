require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const { startWorker } = require('./workers/notificationWorker');
const AnalyticController = require('./controllers/analyticController');

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

var users = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    // Register a new user
    socket.on('register', (userId) => {
        if (users[userId]) {
            delete users[userId];
        }
        users[userId] = socket.id;
        io.emit('activeUser', { count: Object.keys(users).length });
    });

    // Handle incoming analytics
    socket.on('analytics', async (data, callback) => {
        try {
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

    socket.on('disconnect', () => {
        for (let key in users) {
            if (users[key] === socket.id) {
                delete users[key];
                io.emit('activeUser', { count: Object.keys(users).length });
                break;
            }
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
