const express = require("express");
const db = require("../models/database");
const router = express.Router();

// 🔄 Sync player-specific game state (Insert or Update)
router.post("/sync-state", (req, res) => {
    const { roomId, playerId, playCards } = req.body;

    if (!roomId || !playerId || !Array.isArray(playCards)) {
        return res.status(400).json({ message: "Invalid request data" });
    }

    const playCardsJson = JSON.stringify(playCards);

    // Insert or update game state
    db.run(
        `INSERT INTO game_state (room_id, player_id, play_cards) 
         VALUES (?, ?, ?) 
         ON CONFLICT(room_id, player_id) 
         DO UPDATE SET play_cards = ?`,
        [roomId, playerId, playCardsJson, playCardsJson],
        (err) => {
            if (err) {
                return res.status(500).json({ message: "Database error", error: err.message });
            }
            res.json({ message: "Game state updated" });
        }
    );
});

// 📡 Get opponent game states
router.get("/game-state/:roomId/:playerId", (req, res) => {
    const { roomId, playerId } = req.params;

    db.all(
        `SELECT player_id, play_cards FROM game_state WHERE room_id = ? AND player_id != ?`,
        [roomId, playerId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ message: "Database error", error: err.message });
            }

            const opponentBoards = rows.map((row) => ({
                playerId: row.player_id,
                playCards: JSON.parse(row.play_cards || "[]"),
            }));

            res.json({ opponentBoards });
        }
    );
});

// 📝 Save game state
router.post("/save-game", (req, res) => {
    const { gameName, gameState } = req.body;

    if (!gameName || !gameState) {
        return res.status(400).json({ message: "Game name and state are required" });
    }

    const gameStateJson = JSON.stringify(gameState);

    db.run(
        `INSERT INTO saved_states (name, game_state) 
         VALUES (?, ?)
         ON CONFLICT(name) 
         DO UPDATE SET game_state = ?`,
        [gameName, gameStateJson, gameStateJson],
        (err) => {
            if (err) {
                return res.status(500).json({ message: "Database error", error: err.message });
            }
            res.json({ message: "Game state saved successfully" });
        }
    );
});

// 📜 List all saved states
router.get("/saved-states", (req, res) => {
    db.all(
        `SELECT name FROM saved_states ORDER BY created_at DESC`,
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ message: "Database error", error: err.message });
            }
            const savedStates = rows.map(row => row.name);
            res.json({ savedStates });
        }
    );
});

// 📖 Load game state
router.get("/load-game/:name", (req, res) => {
    const { name } = req.params;
    
    db.get(
        `SELECT game_state FROM saved_states WHERE name = ?`,
        [name.replace('.json', '')],
        (err, row) => {
            if (err) {
                return res.status(500).json({ message: "Database error", error: err.message });
            }
            if (!row) {
                return res.status(404).json({ message: "Game state not found" });
            }
            res.json(JSON.parse(row.game_state));
        }
    );
});

// 🗑️ Delete game state
router.delete("/delete-game/:name", (req, res) => {
    const { name } = req.params;
    
    db.run(
        `DELETE FROM saved_states WHERE name = ?`,
        [name],
        (err) => {
            if (err) {
                return res.status(500).json({ message: "Database error", error: err.message });
            }
            res.json({ message: "Game state deleted successfully" });
        }
    );
});

module.exports = router;
