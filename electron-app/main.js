const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { startLocalServer } = require('./local-server');

const PORT = 4173;
let splash, main, httpServer;

// Diagnostics: this process runs detached (no visible console), so log to a file we can inspect —
// console.log alone is invisible once packaged.
const logPath = path.join(app.getPath('temp'), 'vyra-electron-debug.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try { fs.appendFileSync(logPath, line); } catch { /* ignore */ }
}
process.on('uncaughtException', err => log('UNCAUGHT EXCEPTION:', err.stack || err.message));
process.on('unhandledRejection', err => log('UNHANDLED REJECTION:', err?.stack || err));

// Common cause of Electron windows silently failing to appear in restricted/remote/virtualized
// Windows sessions: the sandboxed renderer can't set up its namespace. Disabling it is safe for a
// fully local app like this (no untrusted remote content is ever loaded).
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
log('main.js starting, isPackaged =', app.isPackaged, 'log at', logPath);

function appRoot() {
  // Dev: electron-app/ sits inside the repo, the actual app files are one level up.
  // Packaged: electron-builder copied them into resources/app via extraResources.
  return app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..');
}

function createSplash() {
  log('createSplash()');
  splash = new BrowserWindow({
    width: 520, height: 340, frame: false, resizable: false, movable: true,
    center: true, show: true, backgroundColor: '#0a0611',
    webPreferences: { contextIsolation: true }
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.setMenu(null);
  splash.webContents.on('did-fail-load', (e, code, desc) => log('splash did-fail-load', code, desc));
  splash.on('closed', () => log('splash closed'));
}

function createMainWindow() {
  log('createMainWindow()');
  main = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1000, minHeight: 680,
    show: false, backgroundColor: '#08090d', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  Menu.setApplicationMenu(null);
  main.loadURL(`http://127.0.0.1:${PORT}/studio.html`);
  main.webContents.on('did-fail-load', (e, code, desc) => log('main did-fail-load', code, desc));
  main.webContents.on('render-process-gone', (e, details) => log('main render-process-gone', JSON.stringify(details)));
  main.once('ready-to-show', () => {
    log('main ready-to-show');
    main.show();
    if (splash && !splash.isDestroyed()) splash.destroy();
  });
  main.on('closed', () => { log('main closed'); main = null; app.quit(); });
}

app.whenReady().then(async () => {
  log('app ready');
  createSplash();
  try {
    httpServer = await startLocalServer(appRoot(), PORT);
    log('local server listening on', PORT, 'root =', appRoot());
  } catch (err) {
    log('local server failed to start:', err.message);
  }
  createMainWindow();
}).catch(err => log('app.whenReady chain threw:', err.stack || err.message));

function stopServer() {
  if (httpServer) { try { httpServer.close(); } catch { /* already closed */ } }
}

app.on('window-all-closed', () => { stopServer(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', stopServer);
