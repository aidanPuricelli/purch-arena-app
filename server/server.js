const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const ngrok = require('ngrok');
require("dotenv").config();

// Import routes
const matchmakingRoutes = require("./routes/matchmaking");
const gameStateRoutes = require("./routes/gameState");
const decksRoutes = require("./routes/decks");
const settingsRoutes = require("./routes/settings");
const webrtcRoutes = require("./routes/webrtc");

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

// Serve Angular frontend
app.use(express.static(path.join(__dirname, "../angular-build")));

// Import routes (Pass `io` explicitly to WebRTC)
app.use("/api/matchmaking", require("./routes/matchmaking"));
app.use("/api/game", require("./routes/gameState"));
app.use("/api/decks", require("./routes/decks"));
app.use("/api/settings", require("./routes/settings"));
require("./routes/webrtc")(io); // Pass `io` dynamically

// Serve Angular for any other route
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../angular-build/index.html"));
});

// Initialize ngrok
async function initNgrok() {
    try {
        // Configure ngrok
        await ngrok.authtoken(process.env.NGROK_AUTH_TOKEN);
        console.log('✅ Ngrok initialized successfully');
    } catch (err) {
        console.error('❌ Error initializing ngrok:', err);
        throw err;
    }
}

// Add ngrok configuration before the server.listen call
const startServer = async () => {
    try {
        // Initialize ngrok first
        await initNgrok();

        server.listen(process.env.PORT || 3000, () => {
            console.log(`Server is running on port ${process.env.PORT || 3000}`);
        });
    } catch (err) {
        console.error('Error starting server:', err);
    }
};

startServer();