import { initSelectElementComponent, type SelectElementItem, type SelectElementCallbacks } from '../shared/component';
import type { Collection } from '../../collection-manager/shared/component';
import templateHtml from './template.html?raw';

export type { SelectElementItem, SelectElementCallbacks, Collection };

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

export interface WebSelectElementDeps {
  readFile: (path: string) => Promise<string>;
  onSelect: (itemNames: string[]) => void;
}

export interface WebSelectElementInstance {
  open: (extractedDir: string) => Promise<void>;
  close: () => void;
  setTheme: (theme: string) => void;
}

export function initWebSelectElement(
  deps: WebSelectElementDeps,
  resolveTheme: (theme?: string) => string,
  getThemeFromSettings: () => Promise<string | undefined>
): WebSelectElementInstance {
  injectTemplate();
  const modal = document.getElementById('select-element-modal')!;
  const modalBody = modal.querySelector('.select-element-body')!;
  const closeBtn = document.getElementById('select-element-close')!;

  async function open(extractedDir: string): Promise<void> {
    const themeSetting = await getThemeFromSettings();
    const theme = resolveTheme(themeSetting);
    modal.setAttribute('data-theme', theme);

    let items: Record<string, Record<string, unknown>> = {};
    let collections: Collection[] = [];

    try {
      const gameitemsJson = await deps.readFile(`${extractedDir}/gameitems.json`);
      const gameitemsIndex = JSON.parse(gameitemsJson) as {
        file_name: string;
        editor_layer?: number;
        editor_layer_name?: string;
      }[];
      const results = await Promise.all(
        gameitemsIndex.map(async gi => {
          const fileName = gi.file_name || '';
          if (!fileName) return null;
          try {
            const itemJson = await deps.readFile(`${extractedDir}/gameitems/${fileName}`);
            const itemData = JSON.parse(itemJson);
            const type = Object.keys(itemData)[0];
            const item = itemData[type];
            item._type = type;
            item._fileName = `gameitems/${fileName}`;
            item._layer = gi.editor_layer || 0;
            item._layerName = gi.editor_layer_name || '';
            return { key: item.name || fileName, item };
          } catch {
            return null;
          }
        })
      );
      for (const result of results) {
        if (result) items[result.key] = result.item;
      }
    } catch {
      items = {};
    }

    try {
      const collectionsJson = await deps.readFile(`${extractedDir}/collections.json`);
      collections = JSON.parse(collectionsJson);
    } catch {
      collections = [];
    }

    modalBody.innerHTML = '';
    initSelectElementComponent(modalBody as HTMLElement, items, collections, {
      onSelect: (itemNames: string[]) => {
        deps.onSelect(itemNames);
      },
      onClose: close,
    });

    modal.classList.remove('hidden');
    const filterInput = modalBody.querySelector('.select-element-filter') as HTMLInputElement;
    if (filterInput) filterInput.focus();
  }

  function close(): void {
    modal.classList.add('hidden');
  }

  closeBtn.addEventListener('click', close);

  return {
    open,
    close,
    setTheme: (theme: string) => modal.setAttribute('data-theme', theme),
  };
}
