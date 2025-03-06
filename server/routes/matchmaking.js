const express = require("express");
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const db = require("../models/database");
const ngrok = require('ngrok');
require("dotenv").config();

const router = express.Router();

// Get local IP address
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (!iface.internal && iface.family === 'IPv4') {
                return iface.address;
            }
        }
    }
    return 'localhost'; // Fallback
}

// 🎮 Create a new game room
router.post("/create-room", async (req, res) => {
    try {
        console.log("🔧 Creating game room...");
        const roomId = uuidv4();
        const port = process.env.PORT || 3000;

        // Create ngrok tunnel with more specific configuration
        const url = await ngrok.connect({
            addr: port,
            authtoken: process.env.NGROK_AUTH_TOKEN,
            onStatusChange: status => {
                console.log('Ngrok Status:', status);
            },
            onLogEvent: log => {
                if (log.err) {
                    console.error('Ngrok error:', log.err);
                }
            }
        });
        
        console.log('✅ Ngrok tunnel created:', url);
        
        // Store the ngrok URL in app.locals
        req.app.locals.ngrokUrl = url;

        db.run(
            `INSERT INTO game_rooms (room_id, players, game_state) VALUES (?, ?, ?)`,
            [roomId, "[]", "{}"],
            (err) => {
                if (err) {
                    // Clean up ngrok tunnel if database operation fails
                    ngrok.disconnect(url).catch(console.error);
                    return res.status(500).json({ message: "Database error", error: err.message });
                }

                console.log(`✅ Room ${roomId} created successfully.`);
                console.log(`✅ Ngrok URL: ${url}`);
                res.json({ roomId, serverUrl: url });
            }
        );
    } catch (error) {
        console.error("❌ Error creating room:", error.message);
        res.status(500).json({ message: "Failed to create room", error: error.message });
    }
});

// 🔗 Join an existing room
router.post("/join-room", (req, res) => {
    const { roomId, playerId } = req.body;

    if (!roomId || !playerId) {
        return res.status(400).json({ message: "Room ID and Player ID are required." });
    }

    db.get("SELECT players FROM game_rooms WHERE room_id = ?", [roomId], (err, row) => {
        if (err) {
            return res.status(500).json({ message: "Database error", error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: "Room not found." });
        }

        let players = JSON.parse(row.players || "[]");
        if (!players.includes(playerId)) {
            players.push(playerId);
        }

        db.run(
            `UPDATE game_rooms SET players = ? WHERE room_id = ?`,
            [JSON.stringify(players), roomId],
            (updateErr) => {
                if (updateErr) {
                    return res.status(500).json({ message: "Database update error", error: updateErr.message });
                }
                res.json({ message: "Joined room successfully", players });
            }
        );
    });
});

// 📌 Get room details
router.get("/room/:roomId", (req, res) => {
    const { roomId } = req.params;

    db.get("SELECT * FROM game_rooms WHERE room_id = ?", [roomId], (err, row) => {
        if (err) {
            return res.status(500).json({ message: "Database error", error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: "Room not found." });
        }

        res.json({
            roomId: row.room_id,
            players: JSON.parse(row.players || "[]"),
            gameState: JSON.parse(row.game_state || "{}"),
        });
    });
});

module.exports = router;
