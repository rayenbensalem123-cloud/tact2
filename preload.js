const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Menu events from main process
  onMenuNew: (cb) => ipcRenderer.on('menu-new', cb),
  onMenuOpen: (cb) => ipcRenderer.on('menu-open', (_e, data, basename) => cb(data, basename)),
  onMenuSaveRequest: (cb) => ipcRenderer.on('menu-save-request', cb),
  onMenuSaveAsRequest: (cb) => ipcRenderer.on('menu-saveas-request', cb),
  onMenuExportPng: (cb) => ipcRenderer.on('menu-export-png', cb),
  onMenuExportSvg: (cb) => ipcRenderer.on('menu-export-svg', cb),
  onMenuUndo: (cb) => ipcRenderer.on('menu-undo', cb),
  onMenuRedo: (cb) => ipcRenderer.on('menu-redo', cb),
  onMenuClearDrawings: (cb) => ipcRenderer.on('menu-clear-drawings', cb),
  onMenuResetPlayers: (cb) => ipcRenderer.on('menu-reset-players', cb),
  onMenuView: (cb) => ipcRenderer.on('menu-view', (_e, v) => cb(v)),
  onMenuZoomIn: (cb) => ipcRenderer.on('menu-zoom-in', cb),
  onMenuZoomOut: (cb) => ipcRenderer.on('menu-zoom-out', cb),
  onMenuZoomReset: (cb) => ipcRenderer.on('menu-zoom-reset', cb),
  onMenuToggleGrid: (cb) => ipcRenderer.on('menu-toggle-grid', cb),
  onMenuPrint: (cb) => ipcRenderer.on('menu-print', cb),
  // File operations
  saveFile: (data) => ipcRenderer.send('save-file', data),
  saveAsFile: (data) => ipcRenderer.send('saveas-file', data),
  exportPng: (dataUrl) => ipcRenderer.send('export-png', dataUrl),
  exportSvg: (svgContent) => ipcRenderer.send('export-svg', svgContent),
  saveVideo: (dataUrl, defaultName) => ipcRenderer.send('save-video', dataUrl, defaultName),

  // File operation responses
  onSaveDone: (cb) => ipcRenderer.on('save-done', (_e, data) => cb(data)),
  onSaveAsDone: (cb) => ipcRenderer.on('saveas-done', (_e, data) => cb(data)),
});
