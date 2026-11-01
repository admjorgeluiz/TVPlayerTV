const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  togglePip: () => ipcRenderer.invoke('app:toggle-pip'),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
});
