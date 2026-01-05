import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';

setupThemeListener();

window.vpxEditor.onInitConfirm((data: { title: string; message: string }) => {
  (document.getElementById('confirm-title') as HTMLElement).textContent = data.title || '';
  (document.getElementById('confirm-message') as HTMLElement).textContent = data.message || '';
});

(document.getElementById('confirm-ok') as HTMLButtonElement).addEventListener('click', () => {
  window.vpxEditor.confirmResult(true);
});

(document.getElementById('confirm-cancel') as HTMLButtonElement).addEventListener('click', () => {
  window.vpxEditor.confirmResult(false);
});

setupKeyboardShortcuts({
  onEnter: (): void => window.vpxEditor.confirmResult(true),
  onEscape: (): void => window.vpxEditor.confirmResult(false),
});
