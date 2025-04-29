const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {};
const roomChars = 'abcdefghjkmnpqrstuvwxyz';
const roomLength = 3;

function generateRoomId() {
    let id = '';
    for (let i = 0; i < roomLength; i++) {
        id += roomChars[Math.floor(Math.random() * roomChars.length)];
    }
    return id;
}

wss.on('connection', ws => {
    let roomId = null;
    let userId = uuidv4();

    ws.on('message', message => {
        try {
            const parsedMessage = JSON.parse(message.toString());
            const type = parsedMessage.type;
            const payload = parsedMessage.payload;

            if (type === 'joinRoom') {
                roomId = payload.roomId;
                if (!roomId) {
                    roomId = generateRoomId();
                }

                roomId = roomId.toUpperCase();

                if (!rooms[roomId]) {
                    rooms[roomId] = [];
                }

                rooms[roomId].push({ ws, userId });
                ws.roomId = roomId;
                ws.userId = userId;

                ws.send(JSON.stringify({ type: 'roomJoined', payload: { roomId } }));

                // Check if room is ready
                if (rooms[roomId].length >= 2) {
                    rooms[roomId].forEach(client => {
                        client.ws.send(JSON.stringify({ type: 'ready' }));
                    });
                } else {
                    ws.send(JSON.stringify({ type: 'notReady' }));
                }
            } else if (type === 'file') {
                // TODO: Implement file transfer logic
                // For simplicity in this boilerplate, we'll just broadcast the file
                if (roomId && rooms[roomId]) {
                    rooms[roomId].forEach(client => {
                        if (client.userId !== userId) {
                            client.ws.send(JSON.stringify({ type: 'file', payload: { senderId: userId, data: payload } }));
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to parse message or handle:', error);
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format' } }));
        }
    });

    ws.on('close', () => {
        if (roomId && rooms[roomId]) {
            rooms[roomId] = rooms[roomId].filter(client => client.ws !== ws);
            if (rooms[roomId].length < 2 && rooms[roomId].length > 0) {
                rooms[roomId].forEach(client => {
                    client.ws.send(JSON.stringify({ type: 'notReady' }));
                });
            }
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            }
        }
        console.log(`Client disconnected: ${userId} from room ${roomId}`);
    });

    ws.on('error', error => {
        console.error(`WebSocket error for user ${userId} in room ${roomId}:`, error);
    });

    console.log('Client connected:', userId);
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`WebSocket server running on ws://localhost:${PORT}`); // Note: Listening on localhost internally
});