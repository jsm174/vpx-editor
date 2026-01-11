import {
  createTransformHTML,
  initTransformComponent,
  type TransformData,
  type TransformInitData,
} from '../shared/component';
import templateHtml from './template.html?raw';

export type { TransformData, TransformInitData };

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

export interface WebTransformDeps {
  events: {
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    emit: (event: string, ...args: unknown[]) => void;
  };
}

export function initWebTransform(deps: WebTransformDeps): void {
  injectTemplate();
  const modal = document.getElementById('transform-modal')!;
  const title = document.getElementById('transform-title')!;
  const body = modal.querySelector('.transform-modal-body')!;
  const closeBtn = document.getElementById('transform-close')!;

  let componentInstance: { destroy: () => void } | null = null;
  let pendingTransform: TransformData | null = null;

  function closeModal(): void {
    if (pendingTransform) {
      deps.events.emit('undo-transform');
    }
    deps.events.emit('cancel-transform');
    modal.classList.add('hidden');
    componentInstance?.destroy();
    componentInstance = null;
    pendingTransform = null;
  }

  closeBtn.addEventListener('click', closeModal);

  function showTransform(
    type: 'translate' | 'rotate' | 'scale',
    options?: { centerX: number; centerY: number; mouseX?: number; mouseY?: number }
  ): void {
    const titleMap = { translate: 'Translate', rotate: 'Rotate', scale: 'Scale' };
    title.textContent = titleMap[type];

    body.innerHTML = createTransformHTML();

    const initData: TransformInitData = {
      type,
      centerX: options?.centerX ?? 0,
      centerY: options?.centerY ?? 0,
      mouseX: options?.mouseX ?? 0,
      mouseY: options?.mouseY ?? 0,
    };

    componentInstance = initTransformComponent(body as HTMLElement, initData, {
      onApply: (data: TransformData) => {
        pendingTransform = data;
        deps.events.emit('apply-transform', data);
      },
      onUndo: () => {
        if (pendingTransform) {
          deps.events.emit('undo-transform');
          pendingTransform = null;
        }
      },
      onSave: (data: TransformData) => {
        if (!pendingTransform) {
          deps.events.emit('apply-transform', data);
        }
        deps.events.emit('save-transform', data);
        modal.classList.add('hidden');
        componentInstance?.destroy();
        componentInstance = null;
        pendingTransform = null;
      },
      onCancel: closeModal,
    });

    modal.classList.remove('hidden');
  }

  deps.events.on('show-transform', (...args: unknown[]) => {
    const type = args[0] as 'translate' | 'rotate' | 'scale';
    const options = args[1] as { centerX: number; centerY: number; mouseX?: number; mouseY?: number } | undefined;
    showTransform(type, options);
  });
}
