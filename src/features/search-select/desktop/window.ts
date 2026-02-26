import { initSelectElementComponent, type SelectElementInstance } from '../shared/component';
import type { Collection } from '../../collection-manager/shared/component';

interface InitData {
  extractedDir: string;
  items: Record<string, Record<string, unknown>>;
  collections: Collection[];
  theme?: string;
}

declare global {
  interface Window {
    searchSelect: {
      onInit: (callback: (data: InitData) => void) => void;
      onUpdate: (
        callback: (data: { items: Record<string, Record<string, unknown>>; collections: Collection[] }) => void
      ) => void;
      onSetDisabled: (callback: (disabled: boolean) => void) => void;
      onThemeChanged: (callback: (theme: string) => void) => void;
      selectItem: (itemName: string) => void;
      selectItems: (itemNames: string[]) => void;
      onSelectionChanged: (callback: (selectedItems: string[]) => void) => void;
    };
  }
}

let instance: SelectElementInstance | null = null;

function init(): void {
  if (!window.searchSelect) {
    document.getElementById('app')!.textContent = 'Error: Preload failed';
    return;
  }

  window.searchSelect.onInit(data => {
    if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);

    const container = document.getElementById('app')!;
    container.innerHTML = '';

    instance = initSelectElementComponent(container, data.items || {}, data.collections || [], {
      onSelect: (itemNames: string[]) => {
        window.searchSelect.selectItems(itemNames);
      },
      onClose: () => {},
    });
  });

  window.searchSelect.onUpdate(data => {
    instance?.updateData(data.items || {}, data.collections || []);
  });

  window.searchSelect.onSetDisabled(disabled => {
    instance?.setDisabled(disabled);
  });

  window.searchSelect.onThemeChanged(theme => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  window.searchSelect.onSelectionChanged?.(selectedItems => {
    instance?.setSelectionHighlights(selectedItems);
  });
}

init();
