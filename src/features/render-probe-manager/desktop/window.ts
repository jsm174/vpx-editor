import {
  initRenderProbeManagerComponent,
  type RenderProbeManagerInstance,
  type RenderProbeManagerCallbacks,
  type RenderProbe,
} from '../shared/component';

declare global {
  interface Window {
    renderProbeManager: {
      onInit: (
        callback: (data: { extractedDir: string; probes: Record<string, RenderProbe>; theme?: string }) => void
      ) => void;
      onSetDisabled: (callback: (disabled: boolean) => void) => void;
      onThemeChanged: (callback: (theme: string) => void) => void;
      writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
      notifyRenderProbesChanged: () => void;
      undoBegin: (description: string) => void;
      undoEnd: () => void;
      undoMarkRenderProbes: () => void;
      undoMarkRenderProbeCreate: (name: string) => void;
      undoMarkRenderProbeDelete: (name: string, probeData: RenderProbe) => void;
      showRenamePrompt: (entityType: string, currentName: string, existingNames: string[]) => void;
      onRenameResult: (callback: (result: { oldName: string; newName: string }) => void) => void;
    };
  }
}

let manager: RenderProbeManagerInstance | null = null;

function createCallbacks(): RenderProbeManagerCallbacks {
  return {
    writeFile: async (path: string, content: string) => {
      const result = await window.renderProbeManager.writeFile(path, content);
      if (!result.success) throw new Error(result.error);
    },
    onRenderProbesChanged: () => {
      window.renderProbeManager.notifyRenderProbesChanged();
    },
    undoBegin: (description: string) => window.renderProbeManager.undoBegin(description),
    undoEnd: () => window.renderProbeManager.undoEnd(),
    undoMarkRenderProbes: () => window.renderProbeManager.undoMarkRenderProbes(),
    undoMarkRenderProbeCreate: (name: string) => window.renderProbeManager.undoMarkRenderProbeCreate(name),
    undoMarkRenderProbeDelete: (name: string, probeData: RenderProbe) => {
      window.renderProbeManager.undoMarkRenderProbeDelete(name, probeData);
    },
    openRenamePrompt: (currentName: string, existingNames: string[]) => {
      window.renderProbeManager.showRenamePrompt('renderprobe', currentName, existingNames);
    },
  };
}

function init(): void {
  const theme = new URLSearchParams(window.location.search).get('theme');
  if (theme) document.documentElement.setAttribute('data-theme', theme);

  if (!window.renderProbeManager) {
    document.getElementById('status-bar')!.textContent = 'Error: Preload failed';
    return;
  }

  const elements = {
    probeList: document.getElementById('probe-list')!,
    propertiesContainer: document.getElementById('properties-container')!,
    emptyState: document.getElementById('empty-state')!,
    newBtn: document.getElementById('btn-new')!,
    statusEl: document.getElementById('status-bar')!,
    typePlane: document.getElementById('type-plane') as HTMLInputElement,
    typeScreen: document.getElementById('type-screen') as HTMLInputElement,
    roughness: document.getElementById('roughness') as HTMLInputElement,
    roughnessLabel: document.getElementById('roughness-label')!,
    planeX: document.getElementById('plane-x') as HTMLInputElement,
    planeY: document.getElementById('plane-y') as HTMLInputElement,
    planeZ: document.getElementById('plane-z') as HTMLInputElement,
    planeW: document.getElementById('plane-w') as HTMLInputElement,
    reflectionMode: document.getElementById('reflection-mode') as HTMLSelectElement,
    disableLightmaps: document.getElementById('disable-lightmaps') as HTMLInputElement,
    contextMenu: document.getElementById('context-menu')!,
  };

  const callbacks = createCallbacks();

  manager = initRenderProbeManagerComponent(elements, callbacks);
  manager.setUIDisabled(true);

  window.renderProbeManager.onRenameResult(result => {
    if (manager) {
      manager.applyRename(result.oldName, result.newName);
    }
  });

  window.renderProbeManager.onInit(data => {
    if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);
    manager!.setData({
      extractedDir: data.extractedDir,
      probes: data.probes || {},
    });
    manager!.setUIDisabled(false);
    manager!.renderList();
    document.getElementById('status-bar')!.textContent =
      `Loaded ${Object.keys(data.probes || {}).length} render probes`;
  });

  window.renderProbeManager.onSetDisabled(disabled => {
    manager?.setUIDisabled(disabled);
  });

  window.renderProbeManager.onThemeChanged(theme => {
    document.documentElement.setAttribute('data-theme', theme);
  });
}

init();
