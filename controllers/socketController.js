const redisClient = require("../config/redis");

class SocketController {
    /**
     * Handles /api/send-message endpoint
     */
    static async sendMessage(request, response) {
        const io = request.app.get('io');

        if (!io) {
            console.error('Socket.IO is not initialized');
            return response.json({ status: false, message: 'Socket.IO is not initialized', data: {} });
        }

        if (request.body.event && request.body.user_id && request.body.message) {
            let event = request.body.event;
            let userId = request.body.user_id;
            let message = request.body.message;
            
            try {
                const userSocketId = await redisClient.get(`user:socket:${userId}`);

                if (userSocketId) {
                    if (request.body.data) {
                        io.to(userSocketId).emit(event, { message: message, data: request.body.data });
                    } else {
                        io.to(userSocketId).emit(event, message);
                    }
                    response.json({ status: true, message: 'Message sent successfully', data: {} });
                } else {
                    response.json({ status: false, message: 'Invalid user ID', data: {} });
                }
            } catch (error) {
                response.json({ status: false, message: 'Error accessing Redis: ' + error.message, data: {} });
            }
        } else {
            response.json({ status: true, message: 'Require params are missing', data: {} });
        }
    };

    static async sendMessageToAll(request, response) {
        const io = request.app.get('io');

        if (!io) {
            console.error('Socket.IO is not initialized');
            return response.json({ status: false, message: 'Socket.IO is not initialized', data: {} });
        }

        if (request.body.event && request.body.message) {
            let event = request.body.event;
            let message = request.body.message;

            if (request.body.data) {
                io.emit(event, { message: message, data: request.body.data });
            } else {
                io.emit(event, message);
            }
            response.json({ status: true, message: 'Message sent successfully', data: {} });
        } else {
            response.json({ status: true, message: 'Require params are missing', data: {} });
        }
    };
}

module.exports = SocketController;

