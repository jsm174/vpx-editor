import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('scriptEditor', {
  onInit: callback => ipcRenderer.on('init', (event, data) => callback(data)),
  onThemeChanged: callback => ipcRenderer.on('theme-changed', (event, theme) => callback(theme)),
  saveScript: content => ipcRenderer.invoke('save-script', content),
  notifyScriptChanged: () => ipcRenderer.send('script-changed'),
  onCheckCanClose: callback => ipcRenderer.on('check-can-close', () => callback()),
  respondCanClose: canClose => ipcRenderer.send('can-close-response', canClose),
  onScriptUndone: callback => ipcRenderer.on('script-undone', (event, content) => callback(content)),
  showUnsavedChangesDialog: () => ipcRenderer.invoke('script-editor-unsaved-changes-dialog'),
});
