const { io, users } = require("../server");

class SocketController {
    /**
     * Handles /api/send-message endpoint
     */
    static async sendMessage(request, response) {
        if (request.body.event && request.body.user_id && request.body.message) {
            let event = request.body.event;
            let userId = request.body.user_id;
            let message = request.body.message;
            const userSocketId = users[userId];

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
        } else {
            response.json({ status: true, message: 'Require params are missing', data: {} });
        }
    };

    static async sendMessageToAll(request, response) {
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

