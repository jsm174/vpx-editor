import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';

setupThemeListener();

window.vpxEditor.onInitInfo((data: { title: string; message: string }) => {
  (document.getElementById('info-title') as HTMLElement).textContent = data.title || '';
  (document.getElementById('info-message') as HTMLElement).textContent = data.message || '';
});

const close = (): void => window.vpxEditor.infoModalResult();

(document.getElementById('info-ok') as HTMLButtonElement).addEventListener('click', close);

setupKeyboardShortcuts({
  onEnter: close,
  onEscape: close,
});
