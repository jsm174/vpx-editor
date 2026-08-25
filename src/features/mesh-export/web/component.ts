import { createMeshExportHTML, initMeshExportComponent, type MeshExportOptions } from '../shared/component';
import { DEFAULT_OBJ_ORIENTATION, DEFAULT_OBJ_UNIT } from '../../../shared/constants';
import { defaultExchange, type ObjExchangeOptions } from '../../../shared/obj-transform';
import type { StorageProvider } from '../../../platform/types';
import templateHtml from './template.html?raw';

const STORAGE_KEY = 'objExchange';

interface StoredExchange {
  exportUnit?: string;
  exportOrientation?: string;
  importUnit?: string;
  importOrientation?: string;
}

export async function loadObjExportOptions(storage: StorageProvider): Promise<ObjExchangeOptions> {
  const stored = (await storage.get<StoredExchange>(STORAGE_KEY)) || {};
  return defaultExchange(stored.exportUnit ?? DEFAULT_OBJ_UNIT, stored.exportOrientation ?? DEFAULT_OBJ_ORIENTATION);
}

export async function saveObjExportOptions(storage: StorageProvider, options: ObjExchangeOptions): Promise<void> {
  const stored = (await storage.get<StoredExchange>(STORAGE_KEY)) || {};
  await storage.set(STORAGE_KEY, { ...stored, exportUnit: options.unit, exportOrientation: options.orientation });
}

export async function loadObjImportOptions(storage: StorageProvider): Promise<ObjExchangeOptions> {
  const stored = (await storage.get<StoredExchange>(STORAGE_KEY)) || {};
  return defaultExchange(stored.importUnit ?? DEFAULT_OBJ_UNIT, stored.importOrientation ?? DEFAULT_OBJ_ORIENTATION);
}

export async function saveObjImportOptions(storage: StorageProvider, options: ObjExchangeOptions): Promise<void> {
  const stored = (await storage.get<StoredExchange>(STORAGE_KEY)) || {};
  await storage.set(STORAGE_KEY, { ...stored, importUnit: options.unit, importOrientation: options.orientation });
}

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

export interface WebMeshExportDeps {
  storage: StorageProvider;
  events: {
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    emit: (event: string, ...args: unknown[]) => void;
  };
}

export function initWebMeshExport(deps: WebMeshExportDeps): void {
  injectTemplate();
  const modal = document.getElementById('mesh-export-modal')!;
  const body = modal.querySelector('.mesh-export-modal-body') as HTMLElement;
  const closeBtn = document.getElementById('mesh-export-close')!;

  let componentInstance: { destroy: () => void } | null = null;
  let pendingResolve: ((result: MeshExportOptions | null) => void) | null = null;

  function close(result: MeshExportOptions | null): void {
    modal.classList.add('hidden');
    componentInstance?.destroy();
    componentInstance = null;
    if (pendingResolve) {
      pendingResolve(result);
      pendingResolve = null;
    }
  }

  closeBtn.addEventListener('click', () => close(null));

  deps.events.on('show-mesh-export', async (...args: unknown[]) => {
    const resolve = args[0] as ((result: MeshExportOptions | null) => void) | undefined;
    pendingResolve = resolve ?? null;

    body.innerHTML = createMeshExportHTML(await loadObjExportOptions(deps.storage));
    componentInstance = initMeshExportComponent(body, {
      onExport: async options => {
        await saveObjExportOptions(deps.storage, options);
        close(options);
      },
      onCancel: () => close(null),
    });

    modal.classList.remove('hidden');
  });
}
