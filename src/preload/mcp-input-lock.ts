import { ipcRenderer } from 'electron';

let busy = false;
let previousInert = false;
export function isMcpInputLocked(): boolean {
  return busy;
}
ipcRenderer.on('mcp-edit-busy', (_event, next: boolean) => {
  if (next === busy) return;
  busy = next;
  if (!document.body) return;
  if (busy) {
    previousInert = document.body.inert;
    document.body.inert = true;
  } else document.body.inert = previousInert;
});
window.addEventListener(
  'keydown',
  event => {
    if (busy) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);
