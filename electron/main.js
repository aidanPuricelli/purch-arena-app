const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const Store = require('electron-store');
const fs = require('fs');
const url = require('url');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');

const store = new Store();
let mainWindow;
let db;
let expressApp;
let server;
let io;

// Add this near the top, after imports
process.env.ELECTRON_ENABLE_LOGGING = '1';
process.env.ELECTRON_DEBUG_LOGGING = '1';

// Add IPC handler for toggling fullscreen
ipcMain.on('toggle-fullscreen', () => {
  if (mainWindow) {
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
  }
});

// Initialize Express server
function initExpressServer() {
  expressApp = express();
  expressApp.use(cors());
  expressApp.use(bodyParser.json({ limit: "50mb" }));

  // Create HTTP server
  server = http.createServer(expressApp);

  // Initialize Socket.IO
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  });

  // Import routes
  const decksRoutes = require('../server/routes/decks');
  const settingsRoutes = require('../server/routes/settings');
  const matchmakingRoutes = require('../server/routes/matchmaking');
  const gameStateRoutes = require('../server/routes/gameState');
  const webrtcRoutes = require('../server/routes/webrtc');

  // Use routes
  expressApp.use('/api/decks', decksRoutes);
  expressApp.use('/api/settings', settingsRoutes);
  expressApp.use('/api/matchmaking', matchmakingRoutes);
  expressApp.use('/api/game', gameStateRoutes);
  webrtcRoutes(io);

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Start server
  const port = 3000;
  server.listen(port, () => {
    console.log(`Express server running on port ${port}`);
  });
}

// Enable logging from the main process to renderer
function sendLog(...args) {
  console.log(...args);
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('electron-log', ...args);
  }
}

function registerAssetProtocol() {
  protocol.registerFileProtocol('asset', (request, callback) => {
    try {
      // Remove the protocol and get just the path part
      const filePath = request.url.replace('asset://', '');
      // Decode the URL to handle spaces and special characters
      const decodedPath = decodeURIComponent(filePath);
      
      console.log('Asset protocol request:', {
        originalUrl: request.url,
        decodedPath
      });

      // Use the findAsset function to locate the file
      const resolvedPath = findAsset(decodedPath);
      if (resolvedPath) {
        callback({ path: resolvedPath });
      } else {
        console.error('Asset not found:', decodedPath);
        callback({ error: -2 }); // Net error for file not found
      }
    } catch (error) {
      console.error('Error in asset protocol handler:', error);
      callback({ error: -2 }); // Net error for file not found
    }
  });
}

function createWindow() {
  console.log('Creating main window...');
  
  // Calculate asset path early
  const assetPath = path.join(__dirname, '../frontend/dist/mtg-app/browser').replace(/\\/g, '/');
  console.log('Asset path calculated as:', assetPath);
  
  // Detailed directory checks for fonts only
  const assetsDir = path.join(assetPath, 'assets');
  const fontsDir = path.join(assetsDir, 'fonts');
  
  console.log('\n=== Font Directory Check ===');
  console.log('Fonts directory:', fontsDir);
  if (fs.existsSync(fontsDir)) {
    console.log('✓ Fonts directory exists');
    console.log('Contents:', fs.readdirSync(fontsDir));
  } else {
    console.error('✗ Fonts directory missing');
  }
  console.log('===========================\n');
  
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,  // Temporarily disable for debugging
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [`--asset-path=${assetPath}`]
    }
  });

  // Log startup info
  console.log('App path:', app.getAppPath());
  console.log('Current directory:', __dirname);

  // Handle navigation events
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('Navigation occurred:', url);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('Failed to load:', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    });
    
    // If the main frame fails to load, try reloading
    if (isMainFrame) {
      console.log('Attempting to reload main frame...');
      mainWindow.loadFile(path.join(__dirname, '../frontend/dist/mtg-app/browser/index.html'));
    }
  });

  // In development, load from Angular dev server
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: Loading from http://localhost:4200');
    mainWindow.loadURL('http://localhost:4200');
  } else {
    // In production, load the built Angular app
    const indexPath = path.join(__dirname, '../frontend/dist/mtg-app/browser/index.html');
    console.log('Production mode: Loading index.html from:', indexPath);
    
    // Check if index.html exists
    if (!fs.existsSync(indexPath)) {
      console.error('ERROR: index.html not found at:', indexPath);
    }

    // Check if fonts directory exists and log contents
    const fontsDir = path.join(assetPath, 'assets/fonts');
    if (fs.existsSync(fontsDir)) {
      console.log('Fonts directory exists at:', fontsDir);
      const fonts = fs.readdirSync(fontsDir);
      console.log('Fonts directory contents:', fonts);
    } else {
      console.error('ERROR: Fonts directory not found at:', fontsDir);
    }

    mainWindow.loadFile(indexPath);
  }

  // Open DevTools and ensure it's docked
  mainWindow.webContents.openDevTools({ mode: 'right' });

  // Enhanced error logging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Only log font-related messages
    if (message.includes('font') || message.includes('Font')) {
      console.log(`[Renderer Console] ${message}`);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
    // Set the asset path after the window is loaded
    mainWindow.webContents.executeJavaScript(`
      window.electronAssetPath = "${assetPath}";
      console.log('Asset path set in window:', window.electronAssetPath);
    `).catch(err => {
      console.error('Failed to set asset path:', err);
    });
  });
}

function initDatabase() {
  db = new sqlite3.Database(path.join(app.getPath('userData'), 'mtg.db'), (err) => {
    if (err) {
      console.error('Database opening error: ', err);
    }
    console.log('Connected to the SQLite database.');
  });
}

function findAsset(assetPath) {
  const originalPath = assetPath;
  
  // Clean up the path
  assetPath = assetPath.replace(/^\/+/, ''); // Remove leading slashes
  const fileName = path.basename(assetPath);
  const dirName = path.dirname(assetPath);
  
  // List of possible asset locations
  const possiblePaths = [
    // Built app locations
    path.join(__dirname, '../frontend/dist/mtg-app/browser', assetPath),
    // Handle specific asset types
    path.join(__dirname, '../frontend/dist/mtg-app/browser/assets/symbols-png', fileName),
    path.join(__dirname, '../frontend/dist/mtg-app/browser/assets/images', fileName),
    path.join(__dirname, '../frontend/dist/mtg-app/browser/assets/fonts', fileName),
    // Source locations (fallback)
    path.join(__dirname, '../frontend/src', assetPath),
    path.join(__dirname, '../frontend/src/assets/symbols-png', fileName),
    path.join(__dirname, '../frontend/src/assets/images', fileName),
    path.join(__dirname, '../frontend/src/assets/fonts', fileName)
  ];

  console.log('\n=== Asset Loading Debug ===');
  console.log('Original request:', originalPath);
  console.log('Cleaned path:', assetPath);
  console.log('File name:', fileName);
  console.log('Directory:', dirName);
  console.log('Searching in locations:');
  
  for (const tryPath of possiblePaths) {
    console.log(`Checking: ${tryPath}`);
    try {
      if (fs.existsSync(tryPath)) {
        console.log('✓ Found at:', tryPath);
        return tryPath;
      }
    } catch (error) {
      console.error(`Error checking path ${tryPath}:`, error);
    }
  }
  
  console.log('✗ Asset not found in any location\n');
  return null;
}

// Handle logs from renderer process
ipcMain.on('renderer-log', (event, { type, args }) => {
  console[type]('[Renderer Process]:', ...args);
});

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  console.log('Initializing Express server...');
  initExpressServer();
  
  console.log('Initializing database...');
  initDatabase();
  
  console.log('Registering asset protocol...');
  registerAssetProtocol();
  
  console.log('Creating window...');
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Example IPC handlers for database operations
ipcMain.handle('db-query', async (event, query, params) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('db-run', async (event, query, params) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
});
