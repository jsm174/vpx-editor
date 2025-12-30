import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('searchSelect', {
  onInit: callback => ipcRenderer.on('init', (event, data) => callback(data)),
  onUpdate: callback => ipcRenderer.on('update', (event, data) => callback(data)),
  onSetDisabled: callback => ipcRenderer.on('set-disabled', (event, disabled) => callback(disabled)),
  onThemeChanged: callback => ipcRenderer.on('theme-changed', (event, theme) => callback(theme)),
  selectItem: itemName => ipcRenderer.send('select-item', itemName),
  selectItems: itemNames => ipcRenderer.send('select-items', itemNames),
  onSelectionChanged: callback =>
    ipcRenderer.on('selection-changed', (event, selectedItems) => callback(selectedItems)),
});
