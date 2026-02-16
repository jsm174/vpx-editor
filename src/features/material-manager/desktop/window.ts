import {
  initMaterialManagerComponent,
  type MaterialManagerInstance,
  type MaterialManagerCallbacks,
} from '../shared/component';
import type { Material } from '../../../types/data';

declare global {
  interface Window {
    materialManager: {
      onInit: (
        callback: (data: {
          extractedDir: string;
          materials: Record<string, Material>;
          items: Record<string, unknown>;
          theme?: string;
          selectMaterial?: string;
        }) => void
      ) => void;
      onSelectMaterial: (callback: (materialName: string) => void) => void;
      onSetDisabled: (callback: (disabled: boolean) => void) => void;
      onThemeChanged: (callback: (theme: string) => void) => void;
      writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
      selectItem: (name: string) => void;
      updateItemMaterial: (itemName: string, itemType: string, oldName: string, newName: string) => Promise<void>;
      notifyMaterialsChanged: () => void;
      undoBegin: (description: string) => void;
      undoEnd: () => void;
      undoMarkMaterials: () => void;
      undoMarkMaterialCreate: (name: string) => void;
      undoMarkMaterialDelete: (name: string, materialData: Material) => void;
      undoMarkForUndo: (itemName: string) => void;
      confirm: (message: string) => Promise<boolean>;
      showRenamePrompt: (entityType: string, currentName: string, existingNames: string[]) => void;
      onRenameResult: (callback: (result: { oldName: string; newName: string }) => void) => void;
      openMaterialEditor: (
        material: Record<string, unknown>,
        mode: 'new' | 'clone',
        existingNames: string[],
        originalName: string
      ) => void;
      onMaterialEditorResult: (callback: (result: Record<string, unknown> | null) => void) => void;
      onRefresh: (
        callback: (data: { materials: Record<string, unknown>; items: Record<string, unknown> }) => void
      ) => void;
    };
  }
}

let manager: MaterialManagerInstance | null = null;

function createCallbacks(): MaterialManagerCallbacks {
  return {
    readFile: async () => {
      throw new Error('Not implemented');
    },
    writeFile: async (path: string, content: string) => {
      const result = await window.materialManager.writeFile(path, content);
      if (!result.success) throw new Error(result.error);
    },
    selectItem: (name: string) => {
      window.materialManager.selectItem(name);
    },
    updateItemMaterial: async (itemName: string, itemType: string, oldName: string, newName: string) => {
      await window.materialManager.updateItemMaterial(itemName, itemType, oldName, newName);
    },
    onMaterialsChanged: () => {
      window.materialManager.notifyMaterialsChanged();
    },
    undoBegin: (description: string) => window.materialManager.undoBegin(description),
    undoEnd: () => window.materialManager.undoEnd(),
    undoMarkMaterials: () => window.materialManager.undoMarkMaterials(),
    undoMarkMaterialCreate: (name: string) => window.materialManager.undoMarkMaterialCreate(name),
    undoMarkMaterialDelete: (name: string, materialData: Material) => {
      window.materialManager.undoMarkMaterialDelete(name, materialData);
    },
    undoMarkForUndo: (itemName: string) => window.materialManager.undoMarkForUndo(itemName),
    showConfirm: (message: string) => window.materialManager.confirm(message),
    openRenamePrompt: (currentName: string, existingNames: string[]) => {
      window.materialManager.showRenamePrompt('material', currentName, existingNames);
    },
    openMaterialEditor: (
      material: Record<string, unknown>,
      mode: 'new' | 'clone',
      existingNames: string[],
      originalName: string
    ) => {
      window.materialManager.openMaterialEditor(material, mode, existingNames, originalName);
    },
  };
}

function init(): void {
  const theme = new URLSearchParams(window.location.search).get('theme');
  if (theme) document.documentElement.setAttribute('data-theme', theme);

  if (!window.materialManager) {
    document.getElementById('status-bar')!.textContent = 'Error: Preload failed';
    return;
  }

  const elements = {
    listBody: document.getElementById('material-list-body')!,
    filterInput: document.getElementById('filter') as HTMLInputElement,
    addBtn: document.getElementById('btn-add')!,
    cloneBtn: document.getElementById('btn-clone')!,
    statusEl: document.getElementById('status-bar')!,
    propertiesContainer: document.getElementById('properties-container')!,
    emptyState: document.getElementById('empty-state')!,
    editOverlay: document.getElementById('edit-overlay')!,
    editTitle: document.getElementById('edit-title')!,
    editForm: document.getElementById('edit-form')!,
    editOkBtn: document.getElementById('edit-ok')!,
    editCancelBtn: document.getElementById('edit-cancel')!,
    confirmOverlay: document.getElementById('confirm-overlay')!,
    confirmMessage: document.getElementById('confirm-message')!,
    confirmOkBtn: document.getElementById('confirm-ok')!,
    confirmCancelBtn: document.getElementById('confirm-cancel')!,
    renameOverlay: document.getElementById('rename-overlay')!,
    renameInput: document.getElementById('rename-input') as HTMLInputElement,
    renameError: document.getElementById('rename-error')!,
    renameOkBtn: document.getElementById('rename-ok')!,
    renameCancelBtn: document.getElementById('rename-cancel')!,
    contextMenu: document.getElementById('context-menu')!,
  };

  const renameCloseBtn = document.getElementById('rename-close');
  if (renameCloseBtn) {
    renameCloseBtn.addEventListener('click', () => {
      elements.renameOverlay.classList.add('hidden');
    });
  }

  const callbacks = createCallbacks();

  manager = initMaterialManagerComponent(elements, callbacks);
  manager.setUIDisabled(true);

  window.materialManager.onInit(data => {
    if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);
    manager!.setData({
      extractedDir: data.extractedDir,
      materials: data.materials || {},
      items: (data.items as Record<string, { _type: string; name: string }>) || {},
    });
    manager!.setUIDisabled(false);
    manager!.renderList('');
    if (data.selectMaterial) {
      manager!.selectMaterialByName(data.selectMaterial);
    }
    document.getElementById('status-bar')!.textContent = `Loaded ${Object.keys(data.materials || {}).length} materials`;
  });

  window.materialManager.onSelectMaterial(materialName => {
    manager?.selectMaterialByName(materialName);
  });

  window.materialManager.onSetDisabled(disabled => {
    manager?.setUIDisabled(disabled);
  });

  window.materialManager.onThemeChanged(theme => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  window.materialManager.onRenameResult(result => {
    manager?.performRename(result.oldName, result.newName);
  });

  window.materialManager.onMaterialEditorResult(result => {
    manager?.handleMaterialEditorResult(result);
  });

  window.materialManager.onRefresh(data => {
    const previouslySelected = manager?.getSelectedMaterial();
    manager?.setMaterials(data.materials as Record<string, Material>);
    manager?.setItems(data.items as Record<string, { _type: string; name: string }>);
    manager?.clearSelection();
    manager?.renderList('');
    if (previouslySelected && (data.materials as Record<string, unknown>)[previouslySelected]) {
      manager?.selectMaterialByName(previouslySelected);
    }
    elements.statusEl.textContent = `Refreshed - ${Object.keys(data.materials || {}).length} materials`;
  });
}

init();
