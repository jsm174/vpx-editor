import {
  createMeshExportHTML,
  initMeshExportComponent,
  MESH_EXPORT_TITLES,
  type MeshExportKind,
  type MeshExportOptions,
} from '../shared/component';
import { DEFAULT_OBJ_ORIENTATION, DEFAULT_OBJ_UNIT } from '../../../shared/constants';
import { defaultExchange, normalizeItemFilter, type ObjExchangeOptions } from '../../../shared/obj-transform';
import type { StorageProvider } from '../../../platform/types';
import templateHtml from './template.html?raw';

const STORAGE_KEY = 'objExchange';

interface StoredExchange {
  exportUnit?: string;
  exportOrientation?: string;
  importUnit?: string;
  importOrientation?: string;
  exportItemFilter?: string;
  exportSkipHidden?: boolean;
}

export async function loadObjExportOptions(storage: StorageProvider): Promise<ObjExchangeOptions> {
  const stored = (await storage.get<StoredExchange>(STORAGE_KEY)) || {};
  return defaultExchange(stored.exportUnit ?? DEFAULT_OBJ_UNIT, stored.exportOrientation ?? DEFAULT_OBJ_ORIENTATION);
}

export async function saveObjExportOptions(storage: StorageProvider, options: ObjExchangeOptions): Promise<void> {
  const stored = (await storage.get<StoredExchange>(STORAGE_KEY)) || {};
  await storage.set(STORAGE_KEY, { ...stored, exportUnit: options.unit, exportOrientation: options.orientation });
}

async function loadTableExportOptions(storage: StorageProvider, kind: MeshExportKind): Promise<MeshExportOptions> {
  const stored = (await storage.get<StoredExchange>(STORAGE_KEY)) || {};
  const exchange =
    kind === 'obj' ? await loadObjExportOptions(storage) : defaultExchange(DEFAULT_OBJ_UNIT, DEFAULT_OBJ_ORIENTATION);
  return {
    ...exchange,
    itemFilter: normalizeItemFilter(stored.exportItemFilter),
    skipEditorHiddenItems: stored.exportSkipHidden === true,
  };
}

async function saveTableExportOptions(
  storage: StorageProvider,
  kind: MeshExportKind,
  options: MeshExportOptions
): Promise<void> {
  if (kind === 'obj') await saveObjExportOptions(storage, options);
  const stored = (await storage.get<StoredExchange>(STORAGE_KEY)) || {};
  await storage.set(STORAGE_KEY, {
    ...stored,
    exportItemFilter: options.itemFilter,
    exportSkipHidden: options.skipEditorHiddenItems,
  });
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
  const titleEl = modal.querySelector('.manager-title') as HTMLElement | null;

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
    const kind: MeshExportKind = args[0] === 'glb' ? 'glb' : 'obj';
    const selectedItems = Array.isArray(args[1]) ? (args[1] as string[]) : [];
    const resolve = args[2] as ((result: MeshExportOptions | null) => void) | undefined;
    pendingResolve = resolve ?? null;

    if (titleEl) titleEl.textContent = MESH_EXPORT_TITLES[kind];
    body.innerHTML = createMeshExportHTML({
      kind,
      options: await loadTableExportOptions(deps.storage, kind),
      selectedItems,
    });
    componentInstance = initMeshExportComponent(body, {
      onExport: async options => {
        await saveTableExportOptions(deps.storage, kind, options);
        close(options);
      },
      onCancel: () => close(null),
    });

    modal.classList.remove('hidden');
  });
}
