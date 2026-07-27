'use strict';

const { startLocalServer } = require('./electron-app/local-server');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;

let server;

function logStartup() {
  console.log('');
  console.log('VYRA Live Server är igång');
  console.log(`Studio:  http://127.0.0.1:${PORT}/studio.html`);
  console.log(`Overlay: http://127.0.0.1:${PORT}/overlay.html`);
  console.log('Stoppa med Ctrl+C');
}

function shutdown() {
  if (!server) process.exit(0);
  server.close(() => process.exit(0));
}

startLocalServer(ROOT, PORT)
  .then(instance => {
    server = instance;
    logStartup();
  })
  .catch(err => {
    console.error('Kunde inte starta VYRA-servern:', err && err.message ? err.message : err);
    process.exit(1);
  });

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
