const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const http = require('http');

const PORT = 4173;
let splash, main, serverProcess;

// Diagnostics: this process runs detached (no visible console), so log to a file we can inspect —
// console.log alone is invisible once packaged, and was invisible even in dev via Start-Process.
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

function pingServer() {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${PORT}/api/status`, res => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await pingServer()) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function startServer() {
  log('startServer(), cwd =', appRoot());
  serverProcess = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'server.ps1'], {
    cwd: appRoot(),
    windowsHide: true
  });
  serverProcess.on('error', err => log('server.ps1 spawn error:', err.message));
  serverProcess.on('exit', (code, signal) => log('server.ps1 exited, code =', code, 'signal =', signal));
  serverProcess.stdout.on('data', d => log('server.ps1 stdout:', d.toString().trim()));
  serverProcess.stderr.on('data', d => log('server.ps1 stderr:', d.toString().trim()));
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

function killServer() {
  if (!serverProcess || serverProcess.killed) return;
  try { execSync(`taskkill /PID ${serverProcess.pid} /T /F`); } catch { /* already gone */ }
}

app.whenReady().then(async () => {
  log('app ready');
  createSplash();
  startServer();
  const ready = await waitForServer();
  log('waitForServer resolved:', ready);
  if (!ready) {
    // Still try to show the app — the user can see the connection status in the UI and the server
    // may just be slow to start on a loaded machine, rather than genuinely failed.
    log('[VYRA] Servern svarade inte inom väntetiden, öppnar ändå.');
  }
  createMainWindow();
}).catch(err => log('app.whenReady chain threw:', err.stack || err.message));

app.on('window-all-closed', () => { killServer(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', killServer);
