import {
  initDrawingOrderComponent,
  reorderGameitems,
  type DrawingOrderItem,
  type DrawingOrderMode,
  type DrawingOrderCallbacks,
  type GameItemEntry,
} from '../shared/component';
import templateHtml from './template.html?raw';

export { initDrawingOrderComponent, reorderGameitems };
export type { DrawingOrderItem, DrawingOrderMode, DrawingOrderCallbacks, GameItemEntry };

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

export interface WebDrawingOrderDeps {
  onSave: (orderedNames: string[]) => Promise<void>;
}

export interface WebDrawingOrderInstance {
  show: (mode: DrawingOrderMode, items: DrawingOrderItem[]) => void;
  close: () => void;
  setTheme: (theme: string) => void;
}

export function initWebDrawingOrder(
  deps: WebDrawingOrderDeps,
  resolveTheme: (theme?: string) => string,
  getThemeFromSettings: () => Promise<string | undefined>
): WebDrawingOrderInstance {
  injectTemplate();
  const modal = document.getElementById('drawing-order-modal')!;
  const modalTitle = modal.querySelector('.drawing-order-modal-title')!;
  const modalBody = modal.querySelector('.drawing-order-modal-body')!;
  const closeBtn = document.getElementById('drawing-order-close')!;

  async function show(mode: DrawingOrderMode, items: DrawingOrderItem[]): Promise<void> {
    const themeSetting = await getThemeFromSettings();
    const theme = resolveTheme(themeSetting);
    modal.setAttribute('data-theme', theme);

    const title = mode === 'hit' ? 'Drawing Order (Hit)' : 'Drawing Order (Select)';
    modalTitle.textContent = title;

    modalBody.innerHTML = '';
    initDrawingOrderComponent(modalBody as HTMLElement, mode, items, {
      onSave: async (_mode: DrawingOrderMode, orderedNames: string[]) => {
        close();
        await deps.onSave(orderedNames);
      },
      onCancel: close,
    });

    modal.classList.remove('hidden');
  }

  function close(): void {
    modal.classList.add('hidden');
  }

  closeBtn.addEventListener('click', close);

  return {
    show,
    close,
    setTheme: (theme: string) => modal.setAttribute('data-theme', theme),
  };
}
