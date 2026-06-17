const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentFilePath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'TacticalPad',
    backgroundColor: '#0d0d1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setTitle('TacticalPad - Untitled');
  });

  mainWindow.on('close', async (e) => {
    if (!mainWindow) return;
    try {
      const dirty = await mainWindow.webContents.executeJavaScript('isDirty');
      if (!dirty) { mainWindow.destroy(); return; }
    } catch(_) { mainWindow.destroy(); return; }
    e.preventDefault();
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0, cancelId: 2,
      message: 'You have unsaved changes.',
      detail: 'Do you want to save before closing?'
    });
    if (result.response === 0) {
      mainWindow.webContents.send('menu-save-request');
      const onSaved = () => {
        ipcMain.removeListener('save-done', onSaved);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
      };
      ipcMain.on('save-done', onSaved);
    } else if (result.response === 1) {
      mainWindow.destroy();
    }
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tactics',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-new'),
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              filters: [{ name: 'TacticalPad Files', extensions: ['tactics', 'json'] }],
              properties: ['openFile'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              currentFilePath = result.filePaths[0];
              const data = fs.readFileSync(currentFilePath, 'utf-8');
              mainWindow.webContents.send('menu-open', data, path.basename(currentFilePath));
              mainWindow.setTitle(`TacticalPad - ${path.basename(currentFilePath)}`);
            }
          },
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            mainWindow.webContents.send('menu-save-request');
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            mainWindow.webContents.send('menu-saveas-request');
          },
        },
        { type: 'separator' },
        {
          label: 'Export PNG...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow.webContents.send('menu-export-png'),
        },
        {
          label: 'Export SVG...',
          click: () => mainWindow.webContents.send('menu-export-svg'),
        },
        { type: 'separator' },
        {
          label: 'Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.send('menu-print'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu-undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu-redo'),
        },
        { type: 'separator' },
        {
          label: 'Clear All Drawings',
          click: () => mainWindow.webContents.send('menu-clear-drawings'),
        },
        {
          label: 'Reset Players',
          click: () => mainWindow.webContents.send('menu-reset-players'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Full Pitch',
          type: 'radio',
          checked: true,
          click: () => mainWindow.webContents.send('menu-view', 'full'),
        },
        {
          label: 'Half Pitch (Attack)',
          type: 'radio',
          click: () => mainWindow.webContents.send('menu-view', 'half'),
        },
        {
          label: 'Half Pitch (Defend)',
          type: 'radio',
          click: () => mainWindow.webContents.send('menu-view', 'half-def'),
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow.webContents.send('menu-zoom-in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu-zoom-out'),
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu-zoom-reset'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Grid',
          accelerator: 'CmdOrCtrl+G',
          click: () => mainWindow.webContents.send('menu-toggle-grid'),
        },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          role: 'togglefullscreen',
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About TacticalPad',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About TacticalPad',
              message: 'TacticalPad v1.0.0',
              detail: 'Professional Soccer Tactics Board\n\nBuilt with Electron\n© 2026 TacticalPad',
            });
          },
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Keyboard Shortcuts',
              message: 'Shortcuts',
              detail: [
                'V - Select tool',
                'P - Pen tool',
                'L - Line tool',
                'A - Arrow tool',
                'D - Dashed arrow',
                'R - Rectangle tool',
                'C - Circle tool',
                'E - Eraser tool',
                'T - Text tool',
                '',
                'Ctrl+Z - Undo',
                'Ctrl+Y - Redo',
                'Ctrl+S - Save',
                'Ctrl+O - Open',
                'Ctrl+N - New',
                'Ctrl+P - Print',
                'Ctrl+E - Export PNG',
                'Del - Delete selected player',
                '',
                'Space - Play/Pause animation',
                'Ctrl+K - Add keyframe',
                'Escape - Stop animation',
                '',
                'Mouse wheel - Zoom in/out',
                'Middle mouse drag - Pan',
              ].join('\n'),
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.on('save-file', async (event, data) => {
  if (!currentFilePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'TacticalPad Files', extensions: ['tactics'] }],
      defaultPath: 'untitled.tactics',
    });
    if (result.canceled) return;
    currentFilePath = result.filePath;
  }
  fs.writeFileSync(currentFilePath, data, 'utf-8');
  event.reply('save-done', { path: currentFilePath, basename: path.basename(currentFilePath) });
  mainWindow.setTitle(`TacticalPad - ${path.basename(currentFilePath)}`);
});

ipcMain.on('saveas-file', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'TacticalPad Files', extensions: ['tactics'] }],
    defaultPath: 'untitled.tactics',
  });
  if (result.canceled) return;
  currentFilePath = result.filePath;
  fs.writeFileSync(currentFilePath, data, 'utf-8');
  event.reply('saveas-done', { path: currentFilePath, basename: path.basename(currentFilePath) });
  mainWindow.setTitle(`TacticalPad - ${path.basename(currentFilePath)}`);
});

ipcMain.on('export-png', async (event, dataUrl) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
    defaultPath: 'tactics.png',
  });
  if (result.canceled) return;
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
});

ipcMain.on('export-svg', async (event, svgContent) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'SVG Image', extensions: ['svg'] }],
    defaultPath: 'tactics.svg',
  });
  if (result.canceled) return;
  fs.writeFileSync(result.filePath, svgContent, 'utf-8');
});

ipcMain.on('save-video', async (event, dataUrl, defaultName) => {
  const ext = defaultName.endsWith('.gif') ? 'gif' : 'webm';
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: ext === 'gif' ? 'GIF Image' : 'WebM Video', extensions: [ext] }],
    defaultPath: defaultName,
  });
  if (result.canceled) return;
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
  fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
