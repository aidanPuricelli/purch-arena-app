const express = require("express");
const db = require("../models/database");

const router = express.Router();

// 📌 Get all deck names
router.get("/", (req, res) => {
    db.all("SELECT deck_name FROM decks", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: "Database error", error: err.message });
        }
        const deckNames = rows.map((row) => row.deck_name);
        res.json({ deckNames });
    });
});

// 📌 Get a specific deck
router.get("/:deckName", (req, res) => {
    const { deckName } = req.params;

    db.get("SELECT cards FROM decks WHERE deck_name = ?", [deckName], (err, row) => {
        if (err) {
            return res.status(500).json({ message: "Database error", error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: "Deck not found" });
        }

        res.json({ deck: JSON.parse(row.cards) });
    });
});

// 📌 Create a new deck
router.post("/", (req, res) => {
    const { deckName } = req.body;

    if (!deckName) {
        return res.status(400).json({ message: "Deck name required" });
    }

    db.run("INSERT INTO decks (deck_name, cards) VALUES (?, ?)", [deckName, "[]"], (err) => {
        if (err) {
            return res.status(400).json({ message: "Deck already exists or error", error: err.message });
        }
        res.json({ message: `Deck "${deckName}" created successfully` });
    });
});

// 📌 Update a deck (Add/Remove Cards)
router.post("/:deckName", (req, res) => {
    const { deckName } = req.params;
    const { newCards = [], removedCards = [] } = req.body;

    db.get("SELECT cards FROM decks WHERE deck_name = ?", [deckName], (err, row) => {
        if (err) {
            return res.status(500).json({ message: "Database error", error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: "Deck not found" });
        }

        let deck = JSON.parse(row.cards);

        // Remove specified cards
        removedCards.forEach((removed) => {
            const index = deck.findIndex((card) => card.id === removed.id);
            if (index !== -1) deck.splice(index, 1);
        });

        // Add new cards
        deck = deck.concat(newCards);

        db.run("UPDATE decks SET cards = ? WHERE deck_name = ?", [JSON.stringify(deck), deckName], (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ message: "Failed to update deck", error: updateErr.message });
            }
            res.json({ message: `Deck "${deckName}" updated successfully` });
        });
    });
});

// 📌 Delete a deck
router.delete("/:deckName", (req, res) => {
    const { deckName } = req.params;

    db.run("DELETE FROM decks WHERE deck_name = ?", [deckName], (err) => {
        if (err) {
            return res.status(500).json({ message: "Database error", error: err.message });
        }
        res.json({ message: `Deck "${deckName}" deleted successfully` });
    });
});

// 📌 Get commander for a deck
router.get("/:deckName/commander", (req, res) => {
    const { deckName } = req.params;

    db.get("SELECT commander FROM decks WHERE deck_name = ?", [deckName], (err, row) => {
        if (err) {
            return res.status(500).json({ message: "Database error", error: err.message });
        }
        if (!row || !row.commander) {
            return res.status(404).json({ message: "No commander found" });
        }

        res.json({ commander: JSON.parse(row.commander) });
    });
});

// 📌 Set commander for a deck
router.post("/:deckName/commander", (req, res) => {
    const { deckName } = req.params;
    const { commander } = req.body;

    if (!commander) {
        return res.status(400).json({ message: "Commander data required" });
    }

    db.run(
        "UPDATE decks SET commander = ? WHERE deck_name = ?",
        [JSON.stringify(commander), deckName],
        (err) => {
            if (err) {
                return res.status(500).json({ message: "Failed to set commander", error: err.message });
            }
            res.json({ message: `Commander set for deck "${deckName}"` });
        }
    );
});

module.exports = router;
