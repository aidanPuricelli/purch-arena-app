const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const os = require("os");

// Get platform-specific database storage location
const userDataPath = path.join(os.homedir(), ".mtg-app-electron");
const dbPath = path.join(userDataPath, "mtg-database.sqlite");

// Ensure the directory exists
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

// Initialize SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Error opening database:", err.message);
    } else {
        console.log(`✅ Connected to SQLite database at: ${dbPath}`);
    }
});

// Create tables if they don't exist
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS game_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            player_id TEXT NOT NULL,
            play_cards TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS game_rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL UNIQUE,
            players TEXT, 
            game_state TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS decks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deck_name TEXT UNIQUE NOT NULL,
            cards TEXT DEFAULT '[]',
            commander TEXT DEFAULT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS saved_states (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            game_state TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            card_width INTEGER NOT NULL DEFAULT 200,
            play_options_font_size INTEGER NOT NULL DEFAULT 18,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create ngrok_settings table
    db.run(`
        CREATE TABLE IF NOT EXISTS ngrok_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            token TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insert default settings if they don't exist
    db.run(`
        INSERT OR IGNORE INTO settings (id, card_width, play_options_font_size)
        VALUES (1, 200, 18)
    `);

    // Insert default ngrok settings if they don't exist
    db.run(`
        INSERT OR IGNORE INTO ngrok_settings (id, token)
        VALUES (1, NULL)
    `);
});

module.exports = db;
