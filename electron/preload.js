const { ipcRenderer, contextBridge } = require('electron');

// Get the asset path from the command line arguments
const assetPath = process.argv.find(arg => arg.startsWith('--asset-path=')).split('=')[1];

// Set up the window object before anything else loads
if (typeof window !== 'undefined') {
  window.electronAssetPath = assetPath;
  console.log('Preload: Set electronAssetPath to:', assetPath);
}

// Forward console logs to main process
const originalConsole = { ...console };

// Helper function to make objects IPC-friendly
function makeIPCFriendly(obj) {
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
      __isError: true
    };
  }
  
  if (Array.isArray(obj)) {
    return obj.map(makeIPCFriendly);
  }
  
  if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      try {
        // Test if the value can be cloned
        JSON.stringify(obj[key]);
        newObj[key] = makeIPCFriendly(obj[key]);
      } catch (e) {
        newObj[key] = '[Unserializable data]';
      }
    }
    return newObj;
  }
  
  return obj;
}

// Override console methods
Object.keys(originalConsole).forEach(method => {
  console[method] = (...args) => {
    originalConsole[method](...args);
    try {
      const serializedArgs = args.map(makeIPCFriendly);
      ipcRenderer.send('renderer-log', { type: method, args: serializedArgs });
    } catch (e) {
      originalConsole.error('Failed to send log to main process:', e);
    }
  };
});

// Listen for logs from main process
ipcRenderer.on('electron-log', (event, ...args) => {
  originalConsole.log('[Main Process]:', ...args);
}); 