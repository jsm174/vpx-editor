import { createAboutHTML, initAboutComponent } from '../shared/component.js';
import templateHtml from './template.html?raw';

let templateInjected = false;

function injectTemplate(): void {
  if (templateInjected) return;
  const container = document.createElement('div');
  container.innerHTML = templateHtml;
  while (container.firstChild) {
    document.body.appendChild(container.firstChild);
  }
  templateInjected = true;
}

export interface WebAboutDeps {
  getVersion: () => Promise<string>;
  events: {
    on: (event: string, callback: (...args: unknown[]) => void) => void;
  };
}

export function initWebAbout(deps: WebAboutDeps): void {
  injectTemplate();
  const modal = document.getElementById('about-modal')!;
  const content = modal.querySelector('.about-modal-content')!;
  const closeBtn = document.getElementById('about-modal-close')!;

  let componentInstance: { destroy: () => void } | null = null;

  function closeAbout(): void {
    modal.classList.add('hidden');
    componentInstance?.destroy();
    componentInstance = null;
  }

  async function showAbout(): Promise<void> {
    const version = await deps.getVersion();

    content.innerHTML = createAboutHTML({
      version,
      platform: 'Web',
      iconSrc: 'icons/about-icon.png',
    });

    componentInstance = initAboutComponent(content as HTMLElement, {
      onClose: closeAbout,
    });

    modal.classList.remove('hidden');
  }

  closeBtn.addEventListener('click', closeAbout);
  deps.events.on('show-about', showAbout);
}
