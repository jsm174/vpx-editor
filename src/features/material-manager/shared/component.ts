import type { Material } from '../../../types/data';
import { colorToHexString } from '../../../shared/color-utils';
import { escapeHtml } from '../../../shared/window-utils';
import { addLongPressContextMenu } from '../../../shared/long-press';

export interface MaterialManagerCallbacks {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  selectItem?: (name: string) => void;
  updateItemMaterial?: (itemName: string, itemType: string, oldName: string, newName: string) => Promise<void>;
  onMaterialsChanged?: () => void;
  undoBegin?: (description: string) => void;
  undoEnd?: () => void;
  undoMarkMaterials?: () => void;
  undoMarkMaterialCreate?: (name: string) => void;
  undoMarkMaterialDelete?: (name: string, materialData: Material) => void;
  undoMarkForUndo?: (itemName: string) => void;
  showConfirm?: (message: string) => Promise<boolean>;
  openRenamePrompt?: (currentName: string, existingNames: string[]) => void;
  openMaterialEditor?: (
    material: Record<string, unknown>,
    mode: 'new' | 'clone',
    existingNames: string[],
    originalName: string
  ) => void;
}

interface GameItem {
  _type: string;
  name: string;
  [key: string]: unknown;
}

export interface MaterialManagerData {
  extractedDir: string;
  materials: Record<string, Material>;
  items: Record<string, GameItem>;
  gamedata: Record<string, unknown> | null;
}

export interface MaterialManagerElements {
  listBody: HTMLElement;
  filterInput: HTMLInputElement;
  addBtn: HTMLElement;
  cloneBtn: HTMLElement;
  statusEl: HTMLElement;
  propertiesContainer: HTMLElement;
  emptyState: HTMLElement;
  editOverlay: HTMLElement;
  editTitle: HTMLElement;
  editForm: HTMLElement;
  editOkBtn: HTMLElement;
  editCancelBtn: HTMLElement;
  confirmOverlay: HTMLElement;
  confirmMessage: HTMLElement;
  confirmOkBtn: HTMLElement;
  confirmCancelBtn: HTMLElement;
  renameOverlay?: HTMLElement;
  renameInput?: HTMLInputElement;
  renameError?: HTMLElement;
  renameOkBtn?: HTMLElement;
  renameCancelBtn?: HTMLElement;
  contextMenu: HTMLElement;
}

export interface MaterialManagerInstance {
  renderList: (filter?: string) => void;
  selectMaterial: (name: string) => void;
  selectMaterialByName: (name: string) => void;
  getSelectedMaterial: () => string | null;
  addMaterial: () => Promise<void>;
  cloneMaterial: () => Promise<void>;
  renameMaterial: () => Promise<void>;
  performRename: (oldName: string, newName: string) => Promise<void>;
  deleteMaterial: () => Promise<void>;
  setData: (data: MaterialManagerData) => void;
  setMaterials: (newMaterials: Record<string, Material>) => void;
  setItems: (newItems: Record<string, GameItem>) => void;
  setGamedata: (newGamedata: Record<string, unknown> | null) => void;
  clearSelection: () => void;
  setUIDisabled: (disabled: boolean) => void;
  handleMaterialEditorResult: (result: Record<string, unknown> | null) => Promise<void>;
  destroy: () => void;
}

const MATERIAL_PROPERTIES = [
  { type: 'Wall', props: ['top_material', 'side_material', 'slingshot_material', 'physics_material'] },
  { type: 'Flipper', props: ['material', 'rubber_material'] },
  { type: 'Bumper', props: ['cap_material', 'base_material', 'socket_material', 'ring_material'] },
  { type: 'Ramp', props: ['material', 'physics_material'] },
  { type: 'Spinner', props: ['material'] },
  { type: 'Gate', props: ['material'] },
  { type: 'Plunger', props: ['material'] },
  { type: 'Kicker', props: ['material'] },
  { type: 'Trigger', props: ['material'] },
  { type: 'Light', props: ['material'] },
  { type: 'HitTarget', props: ['material', 'physics_material'] },
  { type: 'Rubber', props: ['material', 'physics_material'] },
  { type: 'Primitive', props: ['material', 'physics_material'] },
  { type: 'Decal', props: ['material'] },
];

const TABLE_MATERIAL_PROPERTIES = ['playfield_material'];

export async function loadMaterialManagerData(
  extractedDir: string,
  callbacks: Pick<MaterialManagerCallbacks, 'readFile'>
): Promise<{
  materials: Record<string, Material>;
  items: Record<string, GameItem>;
  gamedata: Record<string, unknown> | null;
}> {
  let materials: Record<string, Material> = {};
  let items: Record<string, GameItem> = {};
  let gamedata: Record<string, unknown> | null = null;

  try {
    const materialsJson = await callbacks.readFile(`${extractedDir}/materials.json`);
    const materialsArray = JSON.parse(materialsJson) as Material[];
    for (const mat of materialsArray) {
      if (mat.name) materials[mat.name] = mat;
    }
  } catch {
    /* empty */
  }

  try {
    const gameitemsJson = await callbacks.readFile(`${extractedDir}/gameitems.json`);
    const gameitemsList = JSON.parse(gameitemsJson) as { file_name: string }[];
    const fileNames = gameitemsList.map(gi => gi.file_name || '').filter(f => f);
    const results = await Promise.all(
      fileNames.map(async fileName => {
        try {
          const itemJson = await callbacks.readFile(`${extractedDir}/gameitems/${fileName}`);
          const itemData = JSON.parse(itemJson);
          const type = Object.keys(itemData)[0];
          const item = itemData[type];
          item._type = type;
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
    /* empty */
  }

  try {
    const gamedataJson = await callbacks.readFile(`${extractedDir}/gamedata.json`);
    gamedata = JSON.parse(gamedataJson);
  } catch {
    /* empty */
  }

  return { materials, items, gamedata };
}

export function initMaterialManagerComponent(
  elements: MaterialManagerElements,
  callbacks: MaterialManagerCallbacks,
  initialData?: MaterialManagerData
): MaterialManagerInstance {
  let materials: Record<string, Material> = initialData?.materials || {};
  let items: Record<string, GameItem> = initialData?.items || {};
  let gamedata: Record<string, unknown> | null = initialData?.gamedata || null;
  let extractedDir = initialData?.extractedDir || '';
  let selectedMaterial: string | null = null;
  let sortColumn = 'name';
  let sortDirection: 'asc' | 'desc' = 'asc';

  function setStatus(msg: string): void {
    elements.statusEl.textContent = msg;
  }

  function findMaterialUsage(materialName: string): { name: string; type: string; property: string }[] {
    const usedBy: { name: string; type: string; property: string }[] = [];
    for (const [itemName, item] of Object.entries(items)) {
      const typeDef = MATERIAL_PROPERTIES.find(p => p.type === item._type);
      if (!typeDef) continue;
      for (const prop of typeDef.props) {
        if ((item as Record<string, unknown>)[prop] === materialName) {
          usedBy.push({ name: itemName, type: item._type, property: prop });
        }
      }
    }
    if (gamedata) {
      for (const prop of TABLE_MATERIAL_PROPERTIES) {
        if (gamedata[prop] === materialName) {
          usedBy.push({ name: 'Table', type: 'Table', property: prop });
        }
      }
    }
    return usedBy;
  }

  function renderList(filter = ''): void {
    const filterLower = filter.toLowerCase();

    let list = Object.entries(materials).map(([name, mat]) => {
      const usage = findMaterialUsage(name);
      return {
        name,
        type: (mat as unknown as Record<string, unknown>).type || 'basic',
        baseColor: colorToHexString(
          (mat as unknown as Record<string, unknown>).base_color as number | string | undefined
        ),
        used: usage.length > 0,
        usageCount: usage.length,
      };
    });

    if (filterLower) {
      list = list.filter(m => m.name.toLowerCase().includes(filterLower));
    }

    list.sort((a, b) => {
      let aVal: string | number, bVal: string | number;
      switch (sortColumn) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'used':
          aVal = a.usageCount;
          bVal = b.usageCount;
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    elements.listBody.innerHTML = '';

    for (const mat of list) {
      const tr = document.createElement('tr');
      tr.dataset.name = mat.name;
      if (mat.name === selectedMaterial) tr.classList.add('selected');

      const colorTd = document.createElement('td');
      const swatch = document.createElement('span');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = mat.baseColor as string;
      colorTd.appendChild(swatch);

      const nameTd = document.createElement('td');
      nameTd.textContent = mat.name;

      const usedTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `used-badge ${mat.used ? 'yes' : 'no'}`;
      badge.textContent = mat.used ? String(mat.usageCount) : 'No';
      usedTd.appendChild(badge);

      tr.append(colorTd, nameTd, usedTd);
      tr.addEventListener('click', () => selectMaterial(mat.name));
      addLongPressContextMenu(tr);
      tr.addEventListener('contextmenu', e => {
        selectMaterial(mat.name);
        showContextMenu(e);
      });
      elements.listBody.appendChild(tr);
    }
  }

  function selectMaterial(materialName: string): void {
    selectedMaterial = materialName;
    elements.listBody.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
    const row = elements.listBody.querySelector(`tr[data-name="${materialName}"]`);
    if (row) row.classList.add('selected');
    renderProperties(materialName);
  }

  function selectMaterialByName(name: string): void {
    const row = elements.listBody.querySelector(`tr[data-name="${name}"]`) as HTMLElement;
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      selectMaterial(name);
    }
  }

  function renderProperties(materialName: string): void {
    const mat = materials[materialName] as unknown as Record<string, unknown>;
    if (!mat) {
      elements.emptyState.style.display = 'block';
      elements.propertiesContainer.style.display = 'none';
      return;
    }

    elements.emptyState.style.display = 'none';
    elements.propertiesContainer.style.display = 'block';

    const usage = findMaterialUsage(materialName);

    elements.propertiesContainer.innerHTML = `
      <div class="prop-group">
        <div class="prop-group-title">Material</div>
        <div class="prop-row">
          <label class="prop-label">Name</label>
          <input type="text" class="prop-input" value="${escapeHtml(materialName)}" readonly style="background: transparent; border-color: transparent;">
        </div>
        <div class="prop-row">
          <label class="prop-label">Type</label>
          <select class="prop-select" data-prop="type">
            <option value="basic" ${mat.type === 'basic' ? 'selected' : ''}>Basic</option>
            <option value="metal" ${mat.type === 'metal' ? 'selected' : ''}>Metal</option>
          </select>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Base Color</div>
        <div class="prop-row">
          <label class="prop-label">Color</label>
          <input type="color" class="prop-input" data-prop="base_color" value="${colorToHexString(mat.base_color as number | string | undefined)}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Wrap (0..1)</label>
          <input type="number" class="prop-input" data-prop="wrap_lighting" value="${((mat.wrap_lighting as number) ?? 0.25).toFixed(3)}" step="0.01" min="0" max="1">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Glossy Layer</div>
        <div class="prop-row">
          <label class="prop-label">Color</label>
          <input type="color" class="prop-input" data-prop="glossy_color" value="${colorToHexString(mat.glossy_color as number | string | undefined)}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Shininess (0..1)</label>
          <input type="number" class="prop-input" data-prop="roughness" value="${((mat.roughness as number) ?? 0.5).toFixed(3)}" step="0.01" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Use Image (0..1)</label>
          <input type="number" class="prop-input" data-prop="glossy_image_lerp" value="${((mat.glossy_image_lerp as number) ?? 0.5).toFixed(3)}" step="0.01" min="0" max="1">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Clearcoat Layer</div>
        <div class="prop-row">
          <label class="prop-label">Color</label>
          <input type="color" class="prop-input" data-prop="clearcoat_color" value="${colorToHexString(mat.clearcoat_color as number | string | undefined)}">
        </div>
        <div class="prop-row">
          <label class="prop-label">Edge Brightness (0..1)</label>
          <input type="number" class="prop-input" data-prop="edge" value="${((mat.edge as number) ?? 0).toFixed(3)}" step="0.01" min="0" max="1">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Opacity</div>
        <div class="prop-row">
          <label class="prop-label">Enabled</label>
          <input type="checkbox" class="prop-input" data-prop="opacity_active" ${mat.opacity_active ? 'checked' : ''}>
        </div>
        <div class="prop-row">
          <label class="prop-label">Amount (0..1)</label>
          <input type="number" class="prop-input" data-prop="opacity" value="${((mat.opacity as number) ?? 0).toFixed(3)}" step="0.01" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Edge Opacity (0..1)</label>
          <input type="number" class="prop-input" data-prop="edge_alpha" value="${((mat.edge_alpha as number) ?? 1).toFixed(3)}" step="0.01" min="0" max="1">
        </div>
        <div class="prop-row">
          <label class="prop-label">Thickness (0..1)</label>
          <input type="number" class="prop-input" data-prop="thickness" value="${((mat.thickness as number) ?? 0.05).toFixed(3)}" step="0.01" min="0" max="1">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Physics</div>
        <div class="prop-row">
          <label class="prop-label">Elasticity</label>
          <input type="number" class="prop-input" data-prop="elasticity" value="${((mat.elasticity as number) ?? 0).toFixed(3)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Elasticity Falloff</label>
          <input type="number" class="prop-input" data-prop="elasticity_falloff" value="${((mat.elasticity_falloff as number) ?? 0).toFixed(3)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Friction</label>
          <input type="number" class="prop-input" data-prop="friction" value="${((mat.friction as number) ?? 0).toFixed(3)}" step="0.01">
        </div>
        <div class="prop-row">
          <label class="prop-label">Scatter Angle</label>
          <input type="number" class="prop-input" data-prop="scatter_angle" value="${((mat.scatter_angle as number) ?? 0).toFixed(2)}" step="0.5">
        </div>
      </div>

      <div class="prop-group" id="used-by-section">
        <div class="prop-group-title">Used By (${usage.length})</div>
        <div id="used-by-list">
          ${usage.length === 0 ? '<div style="color: var(--text-secondary); font-size: 11px;">Not used</div>' : ''}
        </div>
      </div>
    `;

    const usedByList = elements.propertiesContainer.querySelector('#used-by-list')!;
    for (const item of usage) {
      const div = document.createElement('div');
      div.className = 'manager-used-by-item';
      div.innerHTML = `${escapeHtml(item.name)}<span class="used-by-type">${item.type}</span>`;
      if (callbacks.selectItem) {
        div.addEventListener('click', () => callbacks.selectItem!(item.name));
      }
      usedByList.appendChild(div);
    }

    elements.propertiesContainer.querySelectorAll('.prop-input, .prop-select').forEach(input => {
      input.addEventListener('change', async e => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        const prop = target.dataset.prop;
        if (!prop || !selectedMaterial) return;

        let value: string | number | boolean;
        if (target.type === 'checkbox') {
          value = (target as HTMLInputElement).checked;
        } else if (target.type === 'color' || target.tagName === 'SELECT') {
          value = target.value;
        } else {
          value = parseFloat(target.value);
        }

        callbacks.undoBegin?.(`Change ${selectedMaterial} ${prop}`);
        callbacks.undoMarkMaterials?.();

        (materials[selectedMaterial] as unknown as Record<string, unknown>)[prop] = value;
        await saveMaterials();
        renderList(elements.filterInput.value);
        selectMaterialByName(selectedMaterial);
        setStatus(`Updated ${selectedMaterial}.${prop}`);
        callbacks.undoEnd?.();
        callbacks.onMaterialsChanged?.();
      });
    });
  }

  function getDefaultMaterial(): Record<string, unknown> {
    return {
      name: 'NewMaterial',
      type: 'basic',
      wrap_lighting: 0.25,
      roughness: 0.5,
      glossy_image_lerp: 0.5,
      thickness: 0.05,
      edge: 0.0,
      edge_alpha: 1.0,
      opacity: 0.0,
      base_color: '#808080',
      glossy_color: '#000000',
      clearcoat_color: '#000000',
      opacity_active: false,
      elasticity: 0.0,
      elasticity_falloff: 0.0,
      friction: 0.0,
      scatter_angle: 0.0,
      refraction_tint: '#ffffff',
    };
  }

  let pendingEditMaterial: Record<string, unknown> | null = null;
  let pendingEditMode: 'new' | 'clone' | null = null;

  function showEditDialog(
    mat: Record<string, unknown>,
    mode: 'new' | 'clone'
  ): Promise<Record<string, unknown> | null> {
    return new Promise(resolve => {
      elements.editTitle.textContent = mode === 'new' ? 'New Material' : 'Clone Material';

      elements.editForm.innerHTML = `
        <div class="prop-group">
          <div class="prop-row">
            <label class="prop-label">Name</label>
            <input type="text" class="prop-input" id="edit-name" value="${escapeHtml((mat.name as string) || '')}">
          </div>
          <div class="prop-row">
            <label class="prop-label">Type</label>
            <select class="prop-select" id="edit-type">
              <option value="basic" ${mat.type === 'basic' ? 'selected' : ''}>Basic</option>
              <option value="metal" ${mat.type === 'metal' ? 'selected' : ''}>Metal</option>
            </select>
          </div>
        </div>
        <div class="prop-group">
          <div class="prop-group-title">Physics</div>
          <div class="prop-row">
            <label class="prop-label">Elasticity</label>
            <input type="number" class="prop-input" id="edit-elasticity" value="${((mat.elasticity as number) ?? 0).toFixed(3)}" step="0.01">
          </div>
          <div class="prop-row">
            <label class="prop-label">Elasticity Falloff</label>
            <input type="number" class="prop-input" id="edit-elasticity-falloff" value="${((mat.elasticity_falloff as number) ?? 0).toFixed(3)}" step="0.01">
          </div>
          <div class="prop-row">
            <label class="prop-label">Friction</label>
            <input type="number" class="prop-input" id="edit-friction" value="${((mat.friction as number) ?? 0).toFixed(3)}" step="0.01">
          </div>
          <div class="prop-row">
            <label class="prop-label">Scatter Angle</label>
            <input type="number" class="prop-input" id="edit-scatter" value="${((mat.scatter_angle as number) ?? 0).toFixed(2)}" step="0.5">
          </div>
        </div>
      `;

      elements.editOverlay.classList.remove('hidden');
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      nameInput.focus();
      nameInput.select();

      const existingNames = Object.keys(materials);
      const originalName = (mat.name as string) || '';

      const validateName = (): boolean => {
        const newName = nameInput.value.trim();
        const errorEl = document.getElementById('material-edit-error');
        const okBtn = elements.editOkBtn as HTMLButtonElement;

        if (!newName) {
          if (errorEl) errorEl.textContent = 'Name cannot be empty';
          okBtn.disabled = true;
          return false;
        }

        const newNameLower = newName.toLowerCase();
        const originalNameLower = originalName.toLowerCase();
        const nameExists = existingNames.some(
          n => n.toLowerCase() === newNameLower && n.toLowerCase() !== originalNameLower
        );

        if (nameExists) {
          if (errorEl) errorEl.textContent = 'Material already exists';
          okBtn.disabled = true;
          return false;
        }

        if (errorEl) errorEl.textContent = '';
        okBtn.disabled = false;
        return true;
      };

      nameInput.addEventListener('input', validateName);
      validateName();

      const cleanup = () => {
        elements.editOverlay.classList.add('hidden');
        elements.editOkBtn.onclick = null;
        elements.editCancelBtn.onclick = null;
        const closeBtn = document.getElementById('material-edit-close');
        if (closeBtn) closeBtn.onclick = null;
      };

      elements.editOkBtn.onclick = () => {
        if (!validateName()) return;
        const result = {
          ...mat,
          name: (document.getElementById('edit-name') as HTMLInputElement).value.trim(),
          type: (document.getElementById('edit-type') as HTMLSelectElement).value,
          elasticity: parseFloat((document.getElementById('edit-elasticity') as HTMLInputElement).value),
          elasticity_falloff: parseFloat(
            (document.getElementById('edit-elasticity-falloff') as HTMLInputElement).value
          ),
          friction: parseFloat((document.getElementById('edit-friction') as HTMLInputElement).value),
          scatter_angle: parseFloat((document.getElementById('edit-scatter') as HTMLInputElement).value),
        };
        cleanup();
        resolve(result);
      };

      elements.editCancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };

      const closeBtn = document.getElementById('material-edit-close');
      if (closeBtn) {
        closeBtn.onclick = () => {
          cleanup();
          resolve(null);
        };
      }
    });
  }

  async function addMaterial(): Promise<void> {
    const mat = getDefaultMaterial();
    const existingNames = Object.keys(materials);

    if (callbacks.openMaterialEditor) {
      pendingEditMaterial = mat;
      pendingEditMode = 'new';
      callbacks.openMaterialEditor(mat, 'new', existingNames, '');
      return;
    }

    const result = await showEditDialog(mat, 'new');
    await handleMaterialEditorResult(result);
  }

  async function cloneMaterial(): Promise<void> {
    if (!selectedMaterial) return;

    const srcMat = materials[selectedMaterial];
    if (!srcMat) return;

    const cloned = JSON.parse(JSON.stringify(srcMat));
    cloned.name = selectedMaterial + '_copy';

    const existingNames = Object.keys(materials);

    if (callbacks.openMaterialEditor) {
      pendingEditMaterial = cloned;
      pendingEditMode = 'clone';
      callbacks.openMaterialEditor(cloned, 'clone', existingNames, '');
      return;
    }

    const result = await showEditDialog(cloned, 'clone');
    await handleMaterialEditorResult(result);
  }

  async function handleMaterialEditorResult(result: Record<string, unknown> | null): Promise<void> {
    if (!result || !result.name) {
      pendingEditMaterial = null;
      pendingEditMode = null;
      return;
    }

    if (materials[result.name as string]) {
      setStatus(`Material "${result.name}" already exists`);
      pendingEditMaterial = null;
      pendingEditMode = null;
      return;
    }

    const baseMaterial = pendingEditMaterial || getDefaultMaterial();
    const finalMaterial = { ...baseMaterial, ...result };

    callbacks.undoBegin?.(`${pendingEditMode === 'new' ? 'New' : 'Clone'} material ${result.name}`);
    callbacks.undoMarkMaterials?.();
    callbacks.undoMarkMaterialCreate?.(result.name as string);

    materials[result.name as string] = finalMaterial as unknown as Material;
    await saveMaterials();
    selectedMaterial = result.name as string;
    renderList(elements.filterInput.value);
    selectMaterialByName(result.name as string);
    setStatus(`${pendingEditMode === 'new' ? 'Added' : 'Cloned'}: ${result.name}`);
    callbacks.undoEnd?.();
    callbacks.onMaterialsChanged?.();

    pendingEditMaterial = null;
    pendingEditMode = null;
  }

  let renameCurrentName = '';

  function validateRename(): boolean {
    if (!elements.renameInput || !elements.renameOkBtn || !elements.renameError) return false;
    const newName = elements.renameInput.value.trim();
    const okBtn = elements.renameOkBtn as HTMLButtonElement;

    if (!newName) {
      okBtn.disabled = true;
      elements.renameError.textContent = 'Name cannot be empty';
      return false;
    }

    if (newName === renameCurrentName) {
      okBtn.disabled = true;
      elements.renameError.textContent = '';
      return false;
    }

    const exists = materials[newName] !== undefined;
    if (exists) {
      okBtn.disabled = true;
      elements.renameError.textContent = 'Material already exists';
      return false;
    }

    okBtn.disabled = false;
    elements.renameError.textContent = '';
    return true;
  }

  function openRenameDialog(): void {
    if (!selectedMaterial || !elements.renameInput || !elements.renameError || !elements.renameOverlay) return;
    renameCurrentName = selectedMaterial;
    elements.renameInput.value = selectedMaterial;
    elements.renameError.textContent = '';
    elements.renameOverlay.classList.remove('hidden');
    elements.renameInput.focus();
    elements.renameInput.select();
    validateRename();
  }

  function closeRenameDialog(): void {
    if (elements.renameOverlay) elements.renameOverlay.classList.add('hidden');
  }

  async function executeRename(): Promise<void> {
    if (!selectedMaterial || !elements.renameInput || !validateRename()) return;

    const newName = elements.renameInput.value.trim();
    const oldName = selectedMaterial;

    callbacks.undoBegin?.(`Rename material ${oldName}`);
    callbacks.undoMarkMaterials?.();

    for (const [itemName, item] of Object.entries(items)) {
      const typeDef = MATERIAL_PROPERTIES.find(p => p.type === item._type);
      if (!typeDef) continue;
      for (const prop of typeDef.props) {
        if ((item as Record<string, unknown>)[prop] === oldName) {
          callbacks.undoMarkForUndo?.(itemName);
          break;
        }
      }
    }

    const mat = materials[oldName];
    delete materials[oldName];
    (mat as unknown as Record<string, unknown>).name = newName;
    materials[newName] = mat;

    let updatedCount = 0;
    for (const [itemName, item] of Object.entries(items)) {
      const typeDef = MATERIAL_PROPERTIES.find(p => p.type === item._type);
      if (!typeDef) continue;

      let itemModified = false;
      for (const prop of typeDef.props) {
        if ((item as Record<string, unknown>)[prop] === oldName) {
          (item as Record<string, unknown>)[prop] = newName;
          itemModified = true;
        }
      }

      if (itemModified) {
        updatedCount++;
        await callbacks.updateItemMaterial?.(itemName, item._type, oldName, newName);
      }
    }

    await saveMaterials();
    selectedMaterial = newName;
    closeRenameDialog();
    renderList(elements.filterInput.value);
    selectMaterialByName(newName);

    const statusMsg =
      updatedCount > 0
        ? `Renamed to: ${newName} (updated ${updatedCount} object${updatedCount > 1 ? 's' : ''})`
        : `Renamed to: ${newName}`;
    setStatus(statusMsg);
    callbacks.undoEnd?.();
    callbacks.onMaterialsChanged?.();
  }

  async function renameMaterial(): Promise<void> {
    if (!selectedMaterial) return;
    if (callbacks.openRenamePrompt) {
      callbacks.openRenamePrompt(selectedMaterial, Object.keys(materials));
    } else {
      openRenameDialog();
    }
  }

  async function performRename(oldName: string, newName: string): Promise<void> {
    if (!oldName || !newName || oldName === newName) return;

    if (materials[newName]) {
      setStatus(`Material "${newName}" already exists`);
      return;
    }

    callbacks.undoBegin?.(`Rename material ${oldName}`);
    callbacks.undoMarkMaterials?.();

    for (const [itemName, item] of Object.entries(items)) {
      const typeDef = MATERIAL_PROPERTIES.find(p => p.type === item._type);
      if (!typeDef) continue;
      for (const prop of typeDef.props) {
        if ((item as Record<string, unknown>)[prop] === oldName) {
          callbacks.undoMarkForUndo?.(itemName);
          break;
        }
      }
    }

    const mat = materials[oldName];
    delete materials[oldName];
    (mat as unknown as Record<string, unknown>).name = newName;
    materials[newName] = mat;

    let updatedCount = 0;
    for (const [itemName, item] of Object.entries(items)) {
      const typeDef = MATERIAL_PROPERTIES.find(p => p.type === item._type);
      if (!typeDef) continue;

      let itemModified = false;
      for (const prop of typeDef.props) {
        if ((item as Record<string, unknown>)[prop] === oldName) {
          (item as Record<string, unknown>)[prop] = newName;
          itemModified = true;
        }
      }

      if (itemModified) {
        updatedCount++;
        await callbacks.updateItemMaterial?.(itemName, item._type, oldName, newName);
      }
    }

    await saveMaterials();
    selectedMaterial = newName;
    renderList(elements.filterInput.value);
    selectMaterialByName(newName);

    const statusMsg =
      updatedCount > 0
        ? `Renamed to: ${newName} (updated ${updatedCount} object${updatedCount > 1 ? 's' : ''})`
        : `Renamed to: ${newName}`;
    setStatus(statusMsg);
    callbacks.undoEnd?.();
    callbacks.onMaterialsChanged?.();
  }

  async function deleteMaterial(): Promise<void> {
    if (!selectedMaterial) return;

    const usage = findMaterialUsage(selectedMaterial);
    let msg = `Delete material "${selectedMaterial}"?`;
    if (usage.length > 0) {
      msg = `"${selectedMaterial}" is used by ${usage.length} object(s). Delete anyway?`;
    }

    const confirmed = await showConfirm(msg);
    if (!confirmed) return;

    const materialData = materials[selectedMaterial];

    callbacks.undoBegin?.(`Delete material ${selectedMaterial}`);
    callbacks.undoMarkMaterials?.();
    callbacks.undoMarkMaterialDelete?.(selectedMaterial, materialData);

    const deletedName = selectedMaterial;
    delete materials[selectedMaterial];
    await saveMaterials();

    setStatus(`Deleted: ${deletedName}`);
    selectedMaterial = null;
    elements.emptyState.style.display = 'block';
    elements.propertiesContainer.style.display = 'none';
    renderList(elements.filterInput.value);
    callbacks.undoEnd?.();
    callbacks.onMaterialsChanged?.();
  }

  function showConfirm(message: string): Promise<boolean> {
    if (callbacks.showConfirm) {
      return callbacks.showConfirm(message);
    }
    return new Promise(resolve => {
      elements.confirmMessage.textContent = message;
      elements.confirmOverlay.classList.remove('hidden');
      elements.confirmOkBtn.focus();

      const cleanup = () => {
        elements.confirmOverlay.classList.add('hidden');
        elements.confirmOkBtn.onclick = null;
        elements.confirmCancelBtn.onclick = null;
        document.removeEventListener('keydown', keyHandler);
      };

      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          cleanup();
          resolve(true);
        } else if (e.key === 'Escape') {
          cleanup();
          resolve(false);
        }
      };

      document.addEventListener('keydown', keyHandler);
      elements.confirmOkBtn.onclick = () => {
        cleanup();
        resolve(true);
      };
      elements.confirmCancelBtn.onclick = () => {
        cleanup();
        resolve(false);
      };
    });
  }

  async function saveMaterials(): Promise<void> {
    const materialsArray = Object.values(materials);
    await callbacks.writeFile(`${extractedDir}/materials.json`, JSON.stringify(materialsArray, null, 2));
  }

  function showContextMenu(e: MouseEvent): void {
    e.preventDefault();
    elements.contextMenu.classList.remove('hidden');
    elements.contextMenu.style.left = `${e.clientX}px`;
    elements.contextMenu.style.top = `${e.clientY}px`;
  }

  function hideContextMenu(): void {
    elements.contextMenu.classList.add('hidden');
  }

  elements.contextMenu.addEventListener('click', async e => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (!action) return;
    hideContextMenu();
    switch (action) {
      case 'rename':
        renameMaterial();
        break;
      case 'clone':
        cloneMaterial();
        break;
      case 'delete':
        deleteMaterial();
        break;
    }
  });

  function handleDocumentClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.context-menu')) hideContextMenu();
  }

  function handleDocumentKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') hideContextMenu();
  }

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeydown);

  elements.filterInput.addEventListener('input', () => renderList(elements.filterInput.value));
  elements.addBtn.addEventListener('click', addMaterial);
  elements.cloneBtn.addEventListener('click', cloneMaterial);

  if (elements.renameInput) {
    elements.renameInput.addEventListener('input', validateRename);
    elements.renameInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') executeRename();
      else if (e.key === 'Escape') closeRenameDialog();
    });
  }
  if (elements.renameOkBtn) {
    elements.renameOkBtn.addEventListener('click', executeRename);
  }
  if (elements.renameCancelBtn) {
    elements.renameCancelBtn.addEventListener('click', closeRenameDialog);
  }

  function setupSortHeaders(): void {
    const headerRow = elements.listBody.closest('table')?.querySelector('thead tr');
    if (!headerRow) return;

    headerRow.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = (th as HTMLElement).dataset.sort!;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'asc';
        }
        headerRow.querySelectorAll('th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        renderList(elements.filterInput.value);
      });
    });
  }

  setupSortHeaders();

  function setUIDisabled(disabled: boolean): void {
    if (elements.addBtn instanceof HTMLButtonElement) elements.addBtn.disabled = disabled;
    if (elements.cloneBtn instanceof HTMLButtonElement) elements.cloneBtn.disabled = disabled;
    elements.filterInput.disabled = disabled;
  }

  function setData(data: MaterialManagerData): void {
    extractedDir = data.extractedDir;
    materials = data.materials || {};
    items = data.items || {};
    gamedata = data.gamedata || null;
  }

  function setMaterials(newMaterials: Record<string, Material>): void {
    materials = newMaterials || {};
  }

  function setItems(newItems: Record<string, GameItem>): void {
    items = newItems || {};
  }

  function setGamedata(newGamedata: Record<string, unknown> | null): void {
    gamedata = newGamedata;
  }

  function clearSelection(): void {
    selectedMaterial = null;
    elements.propertiesContainer.innerHTML = '';
    elements.emptyState?.classList.remove('hidden');
    if (elements.propertiesContainer) elements.propertiesContainer.classList.add('hidden');
  }

  function destroy(): void {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleDocumentKeydown);
  }

  return {
    renderList,
    selectMaterial,
    selectMaterialByName,
    getSelectedMaterial: () => selectedMaterial,
    addMaterial,
    cloneMaterial,
    renameMaterial,
    performRename,
    deleteMaterial,
    setData,
    setMaterials,
    setItems,
    setGamedata,
    clearSelection,
    setUIDisabled,
    handleMaterialEditorResult,
    destroy,
  };
}
