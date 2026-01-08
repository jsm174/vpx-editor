import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';

interface AboutData {
  version: string;
}

const versionEl = document.getElementById('about-version') as HTMLElement;

setupThemeListener();

setupKeyboardShortcuts({
  onEscape: (): void => window.close(),
  onEnter: (): void => window.close(),
});

window.vpxEditor.onInitAbout?.((data: AboutData) => {
  versionEl.textContent = `Version ${data.version}`;
});
