const { app, BrowserWindow } = require('electron');
const path = require('path');

process.env.PORT = process.env.PORT || '3000';

// Start the local static/proxy server.
require('./server.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Medical Terminology Explorer'
  });
  win.loadURL(`http://localhost:${process.env.PORT}`);
}

app.whenReady().then(() => {
  // Give the server a moment to start listening.
  setTimeout(createWindow, 500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});