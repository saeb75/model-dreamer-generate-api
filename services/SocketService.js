import { Server } from "socket.io";

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId mapping
  }

  /**
   * Initialize Socket.IO with HTTP server
   * @param {Object} server - HTTP server instance
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.setupEventHandlers();
    console.log("Socket.IO initialized");
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Handle user authentication
      socket.on("authenticate", (data) => {
        const { userId } = data;
        if (userId) {
          this.connectedUsers.set(userId, socket.id);
          socket.userId = userId;
          console.log(`User ${userId} authenticated with socket ${socket.id}`);

          // Join user to their personal room
          socket.join(`user_${userId}`);
        }
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          console.log(`User ${socket.userId} disconnected`);
        }
        console.log(`Socket ${socket.id} disconnected`);
      });

      // Handle generation subscription
      socket.on("subscribe_to_generation", (data) => {
        const { generationId } = data;
        if (generationId) {
          socket.join(`generation_${generationId}`);
          console.log(
            `Socket ${socket.id} subscribed to generation ${generationId}`
          );
        }
      });
    });
  }

  /**
   * Send notification to specific user
   * @param {number} userId - User ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      console.log(`Sent ${event} to user ${userId}`);
    } else {
      console.log(`User ${userId} not connected`);
    }
  }

  /**
   * Send notification to user room
   * @param {number} userId - User ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  sendToUserRoom(userId, event, data) {
    this.io.to(`user_${userId}`).emit(event, data);
    console.log(`Sent ${event} to user room ${userId}`);
  }

  /**
   * Send notification to generation room
   * @param {string} generationId - Generation ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  sendToGeneration(generationId, event, data) {
    this.io.to(`generation_${generationId}`).emit(event, data);
    console.log(`Sent ${event} to generation room ${generationId}`);
  }

  /**
   * Broadcast to all connected users
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcast(event, data) {
    this.io.emit(event, data);
    console.log(`Broadcasted ${event} to all users`);
  }

  /**
   * Get connected users count
   * @returns {number} Number of connected users
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is connected
   * @param {number} userId - User ID
   * @returns {boolean} True if user is connected
   */
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Update generation status and notify subscribers
   * @param {string} generationId - Generation ID
   * @param {Object} statusData - Status data object
   */
  updateGenerationStatus(generationId, statusData) {
    this.sendToGeneration(generationId, "generation_status_update", statusData);
    console.log(`Updated generation status for ${generationId}:`, statusData);
  }
}

export default SocketService;
