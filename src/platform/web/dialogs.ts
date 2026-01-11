import type { DialogProvider, OpenDialogOptions, SaveDialogOptions, MessageBoxOptions } from '../types.js';

export class WebDialogProvider implements DialogProvider {
  async showOpenDialog(options: OpenDialogOptions): Promise<string | null> {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      if (options.filters && options.filters.length > 0) {
        input.accept = options.filters.flatMap(f => f.extensions.map(ext => `.${ext}`)).join(',');
      }
      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          resolve(input.files[0].name);
        } else {
          resolve(null);
        }
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<string | null> {
    const fileName = options.defaultPath?.split('/').pop() || 'download';
    return fileName;
  }

  async showMessageBox(options: MessageBoxOptions): Promise<number> {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const dialog = document.createElement('div');
      dialog.className = 'modal-dialog';
      dialog.style.cssText = `
        background: var(--bg-primary, #1e1e1e);
        border: 1px solid var(--border-color, #3c3c3c);
        border-radius: 8px;
        padding: 20px;
        min-width: 300px;
        max-width: 500px;
        color: var(--text-primary, #cccccc);
      `;

      const iconMap: Record<string, string> = {
        error: '❌',
        warning: '⚠️',
        question: '❓',
        info: 'ℹ️',
      };

      const icon = options.type ? iconMap[options.type] || '' : '';

      dialog.innerHTML = `
        <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 16px;">
          ${icon ? `<span style="font-size: 24px;">${icon}</span>` : ''}
          <div>
            ${options.title ? `<div style="font-weight: bold; margin-bottom: 8px;">${options.title}</div>` : ''}
            <div>${options.message}</div>
            ${options.detail ? `<div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">${options.detail}</div>` : ''}
          </div>
        </div>
        <div class="modal-buttons" style="display: flex; gap: 8px; justify-content: flex-end;"></div>
      `;

      const buttonsContainer = dialog.querySelector('.modal-buttons')!;
      const buttons = options.buttons || ['OK'];

      buttons.forEach((label, index) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = `
          padding: 6px 16px;
          border: 1px solid var(--border-color, #3c3c3c);
          border-radius: 4px;
          background: ${index === options.defaultId ? 'var(--accent-color, #0078d4)' : 'var(--bg-secondary, #2d2d2d)'};
          color: var(--text-primary, #cccccc);
          cursor: pointer;
        `;
        btn.onclick = () => {
          overlay.remove();
          resolve(index);
        };
        buttonsContainer.appendChild(btn);
      });

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      overlay.onclick = e => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(options.defaultId ?? 0);
        }
      };
    });
  }

  showErrorBox(title: string, message: string): void {
    this.showMessageBox({
      type: 'error',
      title,
      message,
      buttons: ['OK'],
    });
  }
}

export function createWebDialogProvider(): WebDialogProvider {
  return new WebDialogProvider();
}
