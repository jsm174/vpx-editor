import { ipcRenderer } from 'electron';

export function createCommonBridge() {
  return {
    onInit: callback => ipcRenderer.on('init', (event, data) => callback(data)),
    onSetDisabled: callback => ipcRenderer.on('set-disabled', (event, disabled) => callback(disabled)),
    onThemeChanged: callback => ipcRenderer.on('theme-changed', (event, theme) => callback(theme)),
    confirm: message => ipcRenderer.invoke('confirm-dialog', message),
    selectItem: itemName => ipcRenderer.send('select-item', itemName),
    undoBegin: description => ipcRenderer.send('undo-begin', description),
    undoEnd: () => ipcRenderer.send('undo-end'),
    undoCancel: () => ipcRenderer.send('undo-cancel'),
    undoMarkForUndo: itemName => ipcRenderer.send('undo-mark-for-undo', itemName),
    undoMarkGamedata: () => ipcRenderer.send('undo-mark-gamedata'),
  };
}
