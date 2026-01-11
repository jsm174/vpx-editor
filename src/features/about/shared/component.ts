export interface AboutCallbacks {
  onClose: () => void;
}

export interface AboutData {
  version: string;
  platform: 'Web' | 'Desktop';
  iconSrc?: string;
}

export function createAboutHTML(data: AboutData): string {
  const iconSrc = data.iconSrc || '/icons/about-icon.png';
  return `
    <div class="about-container">
      <img class="about-icon" src="${iconSrc}" alt="VPX Editor">
      <div class="about-name">VPX Editor</div>
      <div class="about-version">Version ${data.version} [${data.platform}]</div>
      <div class="about-thanks">
        <div class="about-thanks-title">Special Thanks:</div>
        <a href="https://github.com/vpinball/vpinball" target="_blank" rel="noopener">Visual Pinball</a>
        <a href="https://github.com/francisdb/vpin" target="_blank" rel="noopener">vpin</a>
        <a href="https://threejs.org/" target="_blank" rel="noopener">Three.js</a>
        <a href="https://microsoft.github.io/monaco-editor/" target="_blank" rel="noopener">Monaco Editor</a>
      </div>
    </div>
  `;
}

export function initAboutComponent(_container: HTMLElement, callbacks: AboutCallbacks): { destroy: () => void } {
  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      callbacks.onClose();
    }
  };

  document.addEventListener('keydown', handleKeydown);

  return {
    destroy: () => {
      document.removeEventListener('keydown', handleKeydown);
    },
  };
}
