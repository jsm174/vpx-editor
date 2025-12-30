import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('dimensionsManager', {
  onInit: callback => ipcRenderer.on('init-dimensions', (event, data) => callback(data)),
  onThemeChanged: callback => ipcRenderer.on('theme-changed', (event, theme) => callback(theme)),
  onSetDisabled: callback => ipcRenderer.on('set-disabled', (event, disabled) => callback(disabled)),
  applyDimensions: dimensions => ipcRenderer.invoke('apply-dimensions', dimensions),
  close: () => ipcRenderer.send('close-dimensions-manager'),
});
