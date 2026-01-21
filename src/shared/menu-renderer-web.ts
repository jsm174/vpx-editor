import { menuSchema, type MenuItemSchema } from './menu-schema';
import type { MenuState } from './menu-state';
import { evaluateMenuItem, filterMenuForPlatform, formatAccelerator, type EvaluationContext } from './menu-evaluator';

export interface WebMenuCallbacks {
  onAction: (action: string, arg?: string) => void;
}

export interface WebMenuRenderer {
  render: (container: HTMLElement) => void;
  updateState: (state: MenuState) => void;
  destroy: () => void;
}

export function createWebMenuRenderer(callbacks: WebMenuCallbacks): WebMenuRenderer {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const context: EvaluationContext = { platform: 'web', isMac };
  const filteredSchema = filterMenuForPlatform(menuSchema, context);

  let menuContainer: HTMLElement | null = null;
  let currentState: MenuState | null = null;

  function closeAllSubmenus(): void {
    if (!menuContainer) return;
    menuContainer.querySelectorAll('.menu-submenu.expanded').forEach(el => {
      el.classList.remove('expanded');
    });
  }

  function closeMenu(): void {
    if (!menuContainer) return;
    menuContainer.classList.remove('show');
    closeAllSubmenus();
  }

  function menuHasCheckbox(items: MenuItemSchema[]): boolean {
    return items.some(item => item.type === 'checkbox');
  }

  function createMenuItem(
    item: MenuItemSchema,
    state: MenuState,
    parentHasCheckbox: boolean = false
  ): HTMLElement | null {
    if (item.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'menu-separator';
      sep.dataset.menuId = item.id;
      return sep;
    }

    const itemState = evaluateMenuItem(item, state, context);
    if (!itemState.visible) return null;

    const div = document.createElement('div');
    div.className = 'menu-item';
    div.dataset.menuId = item.id;

    if (!itemState.enabled) {
      div.classList.add('disabled');
    }

    if (item.submenu && item.submenu.length > 0) {
      div.classList.add('menu-submenu');

      const labelText = document.createTextNode(itemState.label || item.label || '');
      div.appendChild(labelText);

      const arrow = document.createElement('span');
      arrow.className = 'menu-submenu-arrow';
      arrow.textContent = '▸';
      div.appendChild(arrow);

      const submenu = document.createElement('div');
      submenu.className = 'submenu';

      const submenuHasCheckbox = menuHasCheckbox(item.submenu);
      for (const subItem of item.submenu) {
        const subMenuItem = createMenuItem(subItem, state, submenuHasCheckbox);
        if (subMenuItem) {
          submenu.appendChild(subMenuItem);
        }
      }

      div.appendChild(submenu);

      div.addEventListener('click', e => {
        e.stopPropagation();
        if (div.classList.contains('disabled')) return;

        const wasExpanded = div.classList.contains('expanded');
        const parent = div.parentElement;
        if (parent) {
          parent.querySelectorAll(':scope > .menu-submenu.expanded').forEach(el => {
            if (el !== div) el.classList.remove('expanded');
          });
        }

        if (!wasExpanded) {
          div.classList.add('expanded');
        } else {
          div.classList.remove('expanded');
        }
      });

      div.addEventListener('pointerenter', e => {
        if ((e as PointerEvent).pointerType === 'touch') {
          if (div.classList.contains('disabled')) return;
          const parent = div.parentElement;
          if (parent) {
            parent.querySelectorAll(':scope > .menu-submenu.expanded').forEach(el => {
              if (el !== div) el.classList.remove('expanded');
            });
          }
          div.classList.add('expanded');
        }
      });
    } else {
      let labelHtml = '';

      if (parentHasCheckbox) {
        labelHtml += `<span class="menu-check">${item.type === 'checkbox' && itemState.checked ? '✓' : ''}</span>`;
      }

      labelHtml += itemState.label || item.label || '';

      if (item.accelerator) {
        labelHtml += `<span class="menu-shortcut">${formatAccelerator(item.accelerator, isMac)}</span>`;
      }

      div.innerHTML = labelHtml;

      div.addEventListener('click', e => {
        e.stopPropagation();
        if (div.classList.contains('disabled')) return;

        closeMenu();

        if (item.action) {
          callbacks.onAction(item.action, item.actionArg);
        }
      });
    }

    return div;
  }

  function render(container: HTMLElement): void {
    menuContainer = container;
    if (!currentState) return;

    container.innerHTML = '';

    for (const item of filteredSchema) {
      const menuItem = createMenuItem(item, currentState);
      if (menuItem) {
        container.appendChild(menuItem);
      }
    }

    document.addEventListener('click', e => {
      if (!menuContainer) return;
      const hamburgerBtn = document.getElementById('hamburger-btn');
      if (hamburgerBtn && hamburgerBtn.contains(e.target as Node)) {
        return;
      }
      if (!menuContainer.contains(e.target as Node)) {
        closeMenu();
      }
    });
  }

  function updateMenuItem(element: HTMLElement, item: MenuItemSchema, state: MenuState): void {
    const itemState = evaluateMenuItem(item, state, context);

    if (item.type === 'separator') return;

    if (!itemState.visible) {
      element.style.display = 'none';
      return;
    } else {
      element.style.display = '';
    }

    element.classList.toggle('disabled', !itemState.enabled);

    if (item.type === 'checkbox') {
      const checkmark = element.querySelector('.menu-check');
      if (checkmark) {
        checkmark.textContent = itemState.checked ? '✓' : '';
      }
    }

    if (itemState.label && itemState.label !== item.label) {
      const textEl = element.querySelector('.menu-text');
      if (textEl) {
        textEl.textContent = itemState.label;
      }
    }
  }

  function updateState(state: MenuState): void {
    currentState = state;

    if (!menuContainer) return;

    function processItems(items: MenuItemSchema[]) {
      for (const item of items) {
        const element = menuContainer!.querySelector(`[data-menu-id="${item.id}"]`) as HTMLElement;
        if (element) {
          updateMenuItem(element, item, state);
        }
        if (item.submenu) {
          processItems(item.submenu);
        }
      }
    }

    processItems(filteredSchema);
  }

  function destroy(): void {
    if (menuContainer) {
      menuContainer.innerHTML = '';
    }
    menuContainer = null;
    currentState = null;
  }

  return {
    render,
    updateState,
    destroy,
  };
}
