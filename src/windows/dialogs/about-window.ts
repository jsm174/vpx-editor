import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';

interface AboutData {
  version: string;
  iconPath?: string;
}

const versionEl = document.getElementById('about-version') as HTMLElement;
const iconEl = document.getElementById('about-icon') as HTMLImageElement;

setupThemeListener();

setupKeyboardShortcuts({
  onEscape: (): void => window.close(),
  onEnter: (): void => window.close(),
});

window.vpxEditor.onInitAbout?.((data: AboutData) => {
  versionEl.textContent = `Version ${data.version}`;
  if (data.iconPath) {
    iconEl.src = data.iconPath;
  }
});
