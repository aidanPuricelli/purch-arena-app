const express = require("express");

module.exports = (io) => {
    const router = express.Router();

    if (!global._webrtcInitialized) {
        io.on("connection", (socket) => {
            console.log(`🔗 Player connected: ${socket.id}`);

            socket.on("join-room", ({ roomId, playerId }) => {
                socket.join(roomId);
                console.log(`👥 Player ${playerId} joined room ${roomId}`);
                socket.to(roomId).emit("player-joined", { playerId });
            });

            socket.on("sync-game-state", ({ roomId, playerId, playCards }) => {
                socket.to(roomId).emit("update-game-state", { playerId, playCards });
            });

            socket.on("disconnect", () => {
                console.log(`🔴 Player disconnected: ${socket.id}`);
            });
        });

        global._webrtcInitialized = true; // Prevent duplicate event bindings
    }

    return router;
};
