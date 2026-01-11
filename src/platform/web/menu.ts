import type { MenuProvider, MenuTemplate, MenuItem, MenuStateUpdate } from '../types.js';

export class WebMenuProvider implements MenuProvider {
  private menuElement: HTMLElement | null = null;
  private menuTemplate: MenuTemplate | null = null;
  private menuState: Map<string, { enabled?: boolean; checked?: boolean; visible?: boolean }> = new Map();

  setMenu(template: MenuTemplate): void {
    this.menuTemplate = template;
    this.render();
  }

  updateMenuState(updates: MenuStateUpdate): void {
    for (const [id, state] of Object.entries(updates)) {
      const existing = this.menuState.get(id) || {};
      this.menuState.set(id, { ...existing, ...state });
    }
    this.updateRenderedMenu();
  }

  private getOrCreateMenuElement(): HTMLElement {
    if (this.menuElement) return this.menuElement;

    let container = document.getElementById('hamburger-menu');
    if (!container) {
      container = document.createElement('div');
      container.id = 'hamburger-menu';
      container.className = 'hamburger-menu';
      document.body.appendChild(container);
    }

    this.menuElement = container;
    return container;
  }

  private render(): void {
    if (!this.menuTemplate) return;

    const container = this.getOrCreateMenuElement();
    container.innerHTML = '';

    for (const item of this.menuTemplate.items) {
      const menuItem = this.createMenuItem(item);
      if (menuItem) {
        container.appendChild(menuItem);
      }
    }
  }

  private createMenuItem(item: MenuItem, _isSubmenu = false): HTMLElement | null {
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'menu-separator';
      return sep;
    }

    const div = document.createElement('div');
    div.className = 'menu-item';
    if (item.id) {
      div.dataset.menuId = item.id;
    }

    const state = item.id ? this.menuState.get(item.id) : null;
    const enabled = state?.enabled ?? item.enabled ?? true;
    const visible = state?.visible ?? true;

    if (!visible) {
      div.style.display = 'none';
    }

    if (!enabled) {
      div.classList.add('disabled');
    }

    if (item.submenu && item.submenu.length > 0) {
      div.classList.add('has-submenu');
      div.innerHTML = `
        <span class="menu-label">${item.label || ''}</span>
        <span class="menu-arrow">▶</span>
      `;

      const submenu = document.createElement('div');
      submenu.className = 'submenu';

      for (const subItem of item.submenu) {
        const subMenuItem = this.createMenuItem(subItem, true);
        if (subMenuItem) {
          submenu.appendChild(subMenuItem);
        }
      }

      div.appendChild(submenu);
    } else {
      let labelHtml = item.label || '';

      if (item.type === 'checkbox') {
        const checked = state?.checked ?? item.checked ?? false;
        labelHtml = `<span class="menu-checkbox">${checked ? '✓' : ''}</span>${labelHtml}`;
      }

      if (item.accelerator) {
        labelHtml += `<span class="menu-shortcut">${this.formatAccelerator(item.accelerator)}</span>`;
      }

      div.innerHTML = `<span class="menu-label">${labelHtml}</span>`;

      if (enabled && item.click) {
        div.addEventListener('click', e => {
          e.stopPropagation();
          this.closeMenu();
          item.click!();
        });
      }
    }

    return div;
  }

  private formatAccelerator(accelerator: string): string {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    return accelerator
      .replace('CommandOrControl', isMac ? '⌘' : 'Ctrl')
      .replace('Command', '⌘')
      .replace('Control', 'Ctrl')
      .replace('Alt', isMac ? '⌥' : 'Alt')
      .replace('Shift', isMac ? '⇧' : 'Shift')
      .replace(/\+/g, '');
  }

  private updateRenderedMenu(): void {
    if (!this.menuElement) return;

    for (const [id, state] of this.menuState.entries()) {
      const item = this.menuElement.querySelector(`[data-menu-id="${id}"]`) as HTMLElement;
      if (!item) continue;

      if (state.visible !== undefined) {
        item.style.display = state.visible ? '' : 'none';
      }

      if (state.enabled !== undefined) {
        item.classList.toggle('disabled', !state.enabled);
      }

      if (state.checked !== undefined) {
        const checkbox = item.querySelector('.menu-checkbox');
        if (checkbox) {
          checkbox.textContent = state.checked ? '✓' : '';
        }
      }
    }
  }

  private closeMenu(): void {
    if (this.menuElement) {
      this.menuElement.classList.remove('open');
    }
  }
}

export function createWebMenuProvider(): WebMenuProvider {
  return new WebMenuProvider();
}
