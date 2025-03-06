const express = require("express");
const db = require("../models/database");
const router = express.Router();

// **GET - Load Settings**
router.get("/", (req, res) => {
    db.get("SELECT card_width, play_options_font_size FROM settings WHERE id = 1", [], (err, settings) => {
        if (err) {
            console.error("Failed to load settings:", err);
            return res.status(500).json({ message: "Failed to load settings" });
        }

        // Map database column names to frontend property names
        const mappedSettings = {
            cardWidth: settings?.card_width ?? 200,
            playOptionsFontSize: settings?.play_options_font_size ?? 18
        };

        res.json(mappedSettings);
    });
});

// **POST - Save Settings**
router.post("/", (req, res) => {
    const { cardWidth, playOptionsFontSize } = req.body;

    if (typeof cardWidth !== "number" || typeof playOptionsFontSize !== "number") {
        return res.status(400).json({ message: "Invalid settings data." });
    }

    db.run(
        `UPDATE settings 
         SET card_width = ?, 
             play_options_font_size = ?,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = 1`,
        [cardWidth, playOptionsFontSize],
        (err) => {
            if (err) {
                console.error("Failed to save settings:", err);
                return res.status(500).json({ message: "Failed to save settings" });
            }
            res.json({ message: "Settings saved successfully." });
        }
    );
});

// Add endpoint to get ngrok URL
router.get('/ngrok-url', (req, res) => {
    const ngrokUrl = req.app.locals.ngrokUrl;
    if (ngrokUrl) {
        res.json({ url: ngrokUrl });
    } else {
        res.status(404).json({ message: 'Ngrok URL not available' });
    }
});

// Check if ngrok token exists
router.get('/check-ngrok-token', (req, res) => {
    try {
        db.get("SELECT token FROM ngrok_settings WHERE id = 1", [], (err, row) => {
            if (err) {
                console.error("Error checking ngrok token:", err);
                return res.status(500).json({ message: "Database error while checking token" });
            }
            res.json({ hasToken: !!row?.token });
        });
    } catch (error) {
        console.error("Error in check-ngrok-token route:", error);
        res.status(500).json({ message: "Server error while checking token" });
    }
});

// Save ngrok token
router.post('/ngrok-token', (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ message: "Token is required" });
    }

    try {
        db.run(
            `INSERT OR REPLACE INTO ngrok_settings (id, token, updated_at) 
             VALUES (1, ?, CURRENT_TIMESTAMP)`,
            [token],
            (err) => {
                if (err) {
                    console.error("Error saving ngrok token:", err);
                    return res.status(500).json({ message: "Failed to save token" });
                }
                res.json({ message: "Token saved successfully" });
            }
        );
    } catch (error) {
        console.error("Error in ngrok-token route:", error);
        res.status(500).json({ message: "Server error while saving token" });
    }
});

module.exports = router;
