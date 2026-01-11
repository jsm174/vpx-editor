export interface RenderProbe {
  name: string;
  type_: 'plane_reflection' | 'screen_space_transparency';
  roughness: number;
  reflection_plane?: { x: number; y: number; z: number; w: number };
  reflection_mode?: string;
  disable_light_reflection?: boolean;
}

export interface RenderProbeManagerCallbacks {
  writeFile: (path: string, content: string) => Promise<void>;
  onRenderProbesChanged?: () => void;
  undoBegin?: (description: string) => void;
  undoEnd?: () => void;
  undoMarkRenderProbes?: () => void;
  undoMarkRenderProbeCreate?: (name: string) => void;
  undoMarkRenderProbeDelete?: (name: string, probeData: RenderProbe) => void;
  openRenamePrompt?: (currentName: string, existingNames: string[]) => void;
}

export interface RenderProbeManagerData {
  extractedDir: string;
  probes: Record<string, RenderProbe>;
}

export interface RenderProbeManagerElements {
  probeList: HTMLElement;
  propertiesContainer: HTMLElement;
  emptyState: HTMLElement;
  newBtn: HTMLElement;
  statusEl: HTMLElement;
  typePlane: HTMLInputElement;
  typeScreen: HTMLInputElement;
  roughness: HTMLInputElement;
  roughnessLabel: HTMLElement;
  planeX: HTMLInputElement;
  planeY: HTMLInputElement;
  planeZ: HTMLInputElement;
  planeW: HTMLInputElement;
  reflectionMode: HTMLSelectElement;
  disableLightmaps: HTMLInputElement;
  contextMenu?: HTMLElement;
}

export interface RenderProbeManagerInstance {
  setData: (data: RenderProbeManagerData) => void;
  setUIDisabled: (disabled: boolean) => void;
  renderList: () => void;
  addProbe: () => Promise<void>;
  renameProbe: () => Promise<void>;
  deleteProbe: () => Promise<void>;
  getSelectedProbe: () => string | null;
  applyRename: (oldName: string, newName: string) => Promise<void>;
  destroy: () => void;
}

const PLAYFIELD_PROBE_NAME = 'Playfield Reflections';

function isPlayfieldProbe(name: string): boolean {
  return name === PLAYFIELD_PROBE_NAME;
}

export function initRenderProbeManagerComponent(
  elements: RenderProbeManagerElements,
  callbacks: RenderProbeManagerCallbacks,
  initialData?: RenderProbeManagerData
): RenderProbeManagerInstance {
  let probes: Record<string, RenderProbe> = initialData?.probes || {};
  let extractedDir = initialData?.extractedDir || '';
  let selectedProbe: string | null = null;

  function setStatus(msg: string): void {
    elements.statusEl.textContent = msg;
  }

  function getDefaultProbe(): RenderProbe {
    return {
      type_: 'plane_reflection',
      name: 'New Render Probe',
      roughness: 0,
      reflection_plane: { x: 0, y: 0, z: 1, w: 0 },
      reflection_mode: 'dynamic',
      disable_light_reflection: false,
    };
  }

  function renderList(): void {
    elements.probeList.innerHTML = '';

    const probeNames = Object.keys(probes).sort((a, b) => {
      if (a === PLAYFIELD_PROBE_NAME) return -1;
      if (b === PLAYFIELD_PROBE_NAME) return 1;
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    for (const name of probeNames) {
      const item = document.createElement('div');
      item.className = 'probe-item';
      if (name === selectedProbe) item.classList.add('selected');
      if (isPlayfieldProbe(name)) item.classList.add('protected');
      item.textContent = name;
      item.dataset.name = name;
      item.addEventListener('click', () => selectProbe(name));
      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        selectProbe(name);
        showContextMenu(e, name);
      });
      elements.probeList.appendChild(item);
    }
  }

  function selectProbe(name: string): void {
    if (selectedProbe && selectedProbe !== name) {
      saveProbeFromUI();
    }

    selectedProbe = name;

    elements.probeList.querySelectorAll('.probe-item').forEach(el => {
      el.classList.toggle('selected', (el as HTMLElement).dataset.name === name);
    });

    loadProbeToUI(probes[name]);
  }

  function loadProbeToUI(probe: RenderProbe | undefined): void {
    if (!probe) {
      elements.emptyState.style.display = 'block';
      elements.propertiesContainer.style.display = 'none';
      return;
    }

    elements.emptyState.style.display = 'none';
    elements.propertiesContainer.style.display = 'block';

    const isProtected = isPlayfieldProbe(probe.name);
    const isPlaneReflection = probe.type_ === 'plane_reflection';

    elements.typePlane.checked = isPlaneReflection;
    elements.typeScreen.checked = !isPlaneReflection;
    elements.typePlane.disabled = isProtected;
    elements.typeScreen.disabled = isProtected;

    elements.roughness.value = String(probe.roughness || 0);
    elements.roughnessLabel.textContent = `Level: ${probe.roughness || 0}`;
    elements.roughness.disabled = false;

    const plane = probe.reflection_plane || { x: 0, y: 0, z: 1, w: 0 };
    elements.planeX.value = String(plane.x);
    elements.planeY.value = String(plane.y);
    elements.planeZ.value = String(plane.z);
    elements.planeW.value = String(plane.w);

    const planeDisabled = !isPlaneReflection || isProtected;
    elements.planeX.disabled = planeDisabled;
    elements.planeY.disabled = planeDisabled;
    elements.planeZ.disabled = planeDisabled;
    elements.planeW.disabled = planeDisabled;

    elements.reflectionMode.value = probe.reflection_mode || 'dynamic';
    elements.reflectionMode.disabled = !isPlaneReflection;

    elements.disableLightmaps.checked = probe.disable_light_reflection || false;
    elements.disableLightmaps.disabled = !isPlaneReflection;
  }

  function saveProbeFromUI(): void {
    if (!selectedProbe || !probes[selectedProbe]) return;

    const probe = probes[selectedProbe];
    const isProtected = isPlayfieldProbe(probe.name);

    if (!isProtected) {
      probe.type_ = elements.typePlane.checked ? 'plane_reflection' : 'screen_space_transparency';
    }

    probe.roughness = parseInt(elements.roughness.value, 10);

    if (probe.type_ === 'plane_reflection' && !isProtected) {
      probe.reflection_plane = {
        x: parseFloat(elements.planeX.value) || 0,
        y: parseFloat(elements.planeY.value) || 0,
        z: parseFloat(elements.planeZ.value) || 0,
        w: parseFloat(elements.planeW.value) || 0,
      };
    }

    if (probe.type_ === 'plane_reflection') {
      probe.reflection_mode = elements.reflectionMode.value;
      probe.disable_light_reflection = elements.disableLightmaps.checked;
    }
  }

  function showContextMenu(e: MouseEvent, probeName: string): void {
    if (!elements.contextMenu) return;
    const isProtected = isPlayfieldProbe(probeName);

    elements.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      const action = (item as HTMLElement).dataset.action;
      if (action === 'rename' || action === 'delete') {
        item.classList.toggle('disabled', isProtected);
      }
    });

    elements.contextMenu.style.left = `${e.clientX}px`;
    elements.contextMenu.style.top = `${e.clientY}px`;
    elements.contextMenu.classList.remove('hidden');
  }

  function hideContextMenu(): void {
    if (elements.contextMenu) {
      elements.contextMenu.classList.add('hidden');
    }
  }

  function handleContextMenuClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('context-menu-item') || target.classList.contains('disabled')) {
      hideContextMenu();
      return;
    }

    const action = target.dataset.action;
    hideContextMenu();

    switch (action) {
      case 'rename':
        renameProbe();
        break;
      case 'delete':
        deleteProbe();
        break;
    }
  }

  async function saveProbes(): Promise<void> {
    const probesArray = Object.values(probes);
    await callbacks.writeFile(`${extractedDir}/renderprobes.json`, JSON.stringify(probesArray, null, 2));
  }

  async function addProbe(): Promise<void> {
    const probe = getDefaultProbe();
    let baseName = probe.name;
    let counter = 1;
    while (probes[probe.name]) {
      probe.name = `${baseName} ${counter++}`;
    }

    callbacks.undoBegin?.('Add Render Probe');
    callbacks.undoMarkRenderProbes?.();
    callbacks.undoMarkRenderProbeCreate?.(probe.name);

    probes[probe.name] = probe;
    await saveProbes();
    selectedProbe = probe.name;
    renderList();
    loadProbeToUI(probe);
    setStatus(`Added: ${probe.name}`);

    callbacks.undoEnd?.();
    callbacks.onRenderProbesChanged?.();
  }

  async function applyRename(oldName: string, newName: string): Promise<void> {
    if (!probes[oldName] || isPlayfieldProbe(oldName)) return;

    callbacks.undoBegin?.('Rename Render Probe');
    callbacks.undoMarkRenderProbes?.();

    const probe = probes[oldName];
    delete probes[oldName];
    probe.name = newName;
    probes[newName] = probe;

    await saveProbes();
    selectedProbe = newName;
    renderList();
    loadProbeToUI(probe);
    setStatus(`Renamed: ${oldName} → ${newName}`);

    callbacks.undoEnd?.();
    callbacks.onRenderProbesChanged?.();
  }

  async function renameProbe(): Promise<void> {
    if (!selectedProbe || isPlayfieldProbe(selectedProbe)) return;

    if (callbacks.openRenamePrompt) {
      callbacks.openRenamePrompt(selectedProbe, Object.keys(probes));
    }
  }

  async function deleteProbe(): Promise<void> {
    if (!selectedProbe || isPlayfieldProbe(selectedProbe)) return;

    const confirmed = confirm(`Delete render probe "${selectedProbe}"?`);
    if (!confirmed) return;

    const probeData = probes[selectedProbe];
    const deletedName = selectedProbe;

    callbacks.undoBegin?.('Delete Render Probe');
    callbacks.undoMarkRenderProbes?.();
    callbacks.undoMarkRenderProbeDelete?.(deletedName, probeData);

    delete probes[selectedProbe];
    await saveProbes();

    setStatus(`Deleted: ${deletedName}`);
    selectedProbe = null;
    renderList();
    elements.emptyState.style.display = 'block';
    elements.propertiesContainer.style.display = 'none';

    callbacks.undoEnd?.();
    callbacks.onRenderProbesChanged?.();
  }

  elements.newBtn.addEventListener('click', addProbe);

  if (elements.contextMenu) {
    elements.contextMenu.addEventListener('click', handleContextMenuClick);
  }

  document.addEventListener('click', e => {
    if (elements.contextMenu && !(e.target as HTMLElement).closest('.context-menu')) {
      hideContextMenu();
    }
  });

  [elements.typePlane, elements.typeScreen].forEach(radio => {
    radio.addEventListener('change', async () => {
      if (!selectedProbe) return;

      callbacks.undoBegin?.('Change Render Probe Type');
      callbacks.undoMarkRenderProbes?.();

      saveProbeFromUI();
      await saveProbes();
      loadProbeToUI(probes[selectedProbe]);
      setStatus(`Updated type for ${selectedProbe}`);

      callbacks.undoEnd?.();
      callbacks.onRenderProbesChanged?.();
    });
  });

  elements.roughness.addEventListener('input', () => {
    const val = elements.roughness.value;
    elements.roughnessLabel.textContent = `Level: ${val}`;
  });

  elements.roughness.addEventListener('change', async () => {
    if (!selectedProbe) return;

    callbacks.undoBegin?.('Change Render Probe Roughness');
    callbacks.undoMarkRenderProbes?.();

    saveProbeFromUI();
    await saveProbes();
    setStatus(`Updated roughness for ${selectedProbe}`);

    callbacks.undoEnd?.();
    callbacks.onRenderProbesChanged?.();
  });

  [elements.planeX, elements.planeY, elements.planeZ, elements.planeW].forEach(input => {
    input.addEventListener('change', async () => {
      if (!selectedProbe) return;

      callbacks.undoBegin?.('Change Reflection Plane');
      callbacks.undoMarkRenderProbes?.();

      saveProbeFromUI();
      await saveProbes();
      setStatus(`Updated reflection plane for ${selectedProbe}`);

      callbacks.undoEnd?.();
      callbacks.onRenderProbesChanged?.();
    });
  });

  elements.reflectionMode.addEventListener('change', async () => {
    if (!selectedProbe) return;

    callbacks.undoBegin?.('Change Reflection Mode');
    callbacks.undoMarkRenderProbes?.();

    saveProbeFromUI();
    await saveProbes();
    setStatus(`Updated reflection mode for ${selectedProbe}`);

    callbacks.undoEnd?.();
    callbacks.onRenderProbesChanged?.();
  });

  elements.disableLightmaps.addEventListener('change', async () => {
    if (!selectedProbe) return;

    callbacks.undoBegin?.('Toggle Disable Lightmaps');
    callbacks.undoMarkRenderProbes?.();

    saveProbeFromUI();
    await saveProbes();
    setStatus(`Updated lightmaps setting for ${selectedProbe}`);

    callbacks.undoEnd?.();
    callbacks.onRenderProbesChanged?.();
  });

  function setUIDisabled(disabled: boolean): void {
    if (elements.newBtn instanceof HTMLButtonElement) elements.newBtn.disabled = disabled;
  }

  function setData(data: RenderProbeManagerData): void {
    extractedDir = data.extractedDir;
    probes = data.probes || {};
  }

  function destroy(): void {
    // Cleanup if needed
  }

  return {
    setData,
    setUIDisabled,
    renderList,
    addProbe,
    renameProbe,
    deleteProbe,
    getSelectedProbe: () => selectedProbe,
    applyRename,
    destroy,
  };
}
