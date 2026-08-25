import type { ObjExchangeOptions, ObjOrientation } from '../../../shared/obj-transform.js';
import { parseObjHeaderComment } from '../../../shared/obj-transform.js';
import {
  DEFAULT_OBJ_EXCHANGE,
  getObjProfileValue,
  objProfileRadiosHtml,
  optionsForProfile,
  profileFor,
  setObjProfileValue,
} from '../../../shared/obj-exchange-ui.js';

export interface MeshImportOptions {
  centerMesh: boolean;
  importMaterial: boolean;
  absolutePosition: boolean;
  unit: string;
  orientation: ObjOrientation;
}

export const DEFAULT_MESH_IMPORT_EXCHANGE: ObjExchangeOptions = DEFAULT_OBJ_EXCHANGE;

export interface MeshImportBrowseResult {
  path: string;
  content: string;
  header?: string;
  extras?: Map<string, string>;
}

export interface MeshImportCallbacks {
  onBrowse: () => Promise<MeshImportBrowseResult | null>;
  onImport: (filePath: string, content: string, options: MeshImportOptions, extras?: Map<string, string>) => void;
  onCancel: () => void;
}

export function createMeshImportHTML(exchange: ObjExchangeOptions = DEFAULT_MESH_IMPORT_EXCHANGE): string {
  return `
    <div class="mesh-import-container">
      <div class="mesh-import-file-row">
        <label>File</label>
        <input type="text" id="mesh-import-path" class="win-input" readonly>
        <button class="win-btn" id="mesh-import-browse">Browse</button>
      </div>

      <fieldset class="mesh-import-options">
        <legend>Options</legend>
        <div class="mesh-import-grid">
          <label><input type="checkbox" id="mesh-import-center-mesh"> Center mesh to it's midpoint</label>
          <label><input type="checkbox" id="mesh-import-material"> Import mesh's material</label>
          <div></div>
          <label class="full-width"><input type="radio" name="mesh-position" id="mesh-import-rel-position" checked> Place at primitive's position</label>
          <label class="full-width"><input type="radio" name="mesh-position" id="mesh-import-abs-position"> Place at mesh's absolute position (use mesh's midpoint)</label>
        </div>
      </fieldset>

      <fieldset class="mesh-import-options">
        <legend>Units and axes</legend>
        <div class="mesh-import-exchange">
          ${objProfileRadiosHtml('mesh-import-profile', exchange)}

          <div class="mesh-import-detected hidden" id="mesh-import-detected"></div>
        </div>
      </fieldset>

      <div class="mesh-import-footer">
        <button class="win-btn" id="mesh-import-cancel">Cancel</button>
        <button class="win-btn primary" id="mesh-import-ok" disabled>Import</button>
      </div>
    </div>
  `;
}

export function initMeshImportComponent(
  container: HTMLElement,
  callbacks: MeshImportCallbacks
): { destroy: () => void } {
  const pathInput = container.querySelector('#mesh-import-path') as HTMLInputElement;
  const browseBtn = container.querySelector('#mesh-import-browse') as HTMLButtonElement;
  const okBtn = container.querySelector('#mesh-import-ok') as HTMLButtonElement;
  const cancelBtn = container.querySelector('#mesh-import-cancel') as HTMLButtonElement;

  const centerMeshCheck = container.querySelector('#mesh-import-center-mesh') as HTMLInputElement;
  const materialCheck = container.querySelector('#mesh-import-material') as HTMLInputElement;
  const absPositionRadio = container.querySelector('#mesh-import-abs-position') as HTMLInputElement;
  const detected = container.querySelector('#mesh-import-detected') as HTMLElement;

  let selectedFilePath = '';
  let selectedFileContent = '';
  let selectedExtras: Map<string, string> | undefined;

  const handleBrowse = async () => {
    const result = await callbacks.onBrowse();
    if (result) {
      selectedFilePath = result.path;
      selectedFileContent = result.content;
      selectedExtras = result.extras;
      pathInput.value = result.path;
      okBtn.disabled = false;

      const fromHeader = parseObjHeaderComment(result.header ?? result.content);
      if (fromHeader) {
        setObjProfileValue(container, 'mesh-import-profile', profileFor(fromHeader).value);
        detected.textContent = 'Units and axes detected from the file.';
        detected.classList.remove('hidden');
      } else {
        detected.classList.add('hidden');
      }
    }
  };

  const handleImport = () => {
    if (!selectedFilePath || !selectedFileContent) return;

    const options: MeshImportOptions = {
      centerMesh: centerMeshCheck.checked,
      importMaterial: materialCheck.checked,
      absolutePosition: absPositionRadio.checked,
      ...optionsForProfile(getObjProfileValue(container, 'mesh-import-profile')),
    };

    callbacks.onImport(selectedFilePath, selectedFileContent, options, selectedExtras);
  };

  const handleCancel = () => {
    callbacks.onCancel();
  };

  browseBtn.addEventListener('click', handleBrowse);
  okBtn.addEventListener('click', handleImport);
  cancelBtn.addEventListener('click', handleCancel);

  return {
    destroy: () => {
      browseBtn.removeEventListener('click', handleBrowse);
      okBtn.removeEventListener('click', handleImport);
      cancelBtn.removeEventListener('click', handleCancel);
    },
  };
}

export interface ParsedMaterial {
  name: string;
  type: string;
  base_color: string;
  glossy_color: string;
  clearcoat_color: string;
  wrap_lighting: number;
  roughness: number;
  glossy_image_lerp: number;
  thickness: number;
  edge: number;
  edge_alpha: number;
  opacity: number;
  opacity_active: boolean;
  refraction_tint: string;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter_angle: number;
}

export function parseMtlContent(content: string): ParsedMaterial | null {
  const lines = content.split('\n');
  let material: ParsedMaterial | null = null;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'newmtl' && parts[1]) {
      material = {
        name: parts[1],
        type: 'Basic',
        base_color: '#808080',
        glossy_color: '#000000',
        clearcoat_color: '#000000',
        wrap_lighting: 0.5,
        roughness: 0.5,
        glossy_image_lerp: 1.0,
        thickness: 0.05,
        edge: 1.0,
        edge_alpha: 1.0,
        opacity: 1.0,
        opacity_active: true,
        refraction_tint: '#ffffff',
        elasticity: 0.3,
        elasticity_falloff: 0.0,
        friction: 0.3,
        scatter_angle: 0.0,
      };
    } else if (material) {
      if (parts[0] === 'Kd' && parts.length >= 4) {
        const r = Math.round((parseFloat(parts[1]) || 0) * 255);
        const g = Math.round((parseFloat(parts[2]) || 0) * 255);
        const b = Math.round((parseFloat(parts[3]) || 0) * 255);
        material.base_color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      } else if (parts[0] === 'Ks' && parts.length >= 4) {
        const r = Math.round((parseFloat(parts[1]) || 0) * 255);
        const g = Math.round((parseFloat(parts[2]) || 0) * 255);
        const b = Math.round((parseFloat(parts[3]) || 0) * 255);
        material.glossy_color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      } else if (parts[0] === 'Ns') {
        const ns = parseFloat(parts[1]) || 0;
        material.roughness = Math.max(0, Math.min(1, 0.5 + ns / 2000.0));
      } else if (parts[0] === 'd') {
        material.opacity = parseFloat(parts[1]) || 1.0;
      }
    }
  }

  return material;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

export function generateMtlContent(
  materialName: string,
  material: {
    base_color?: string;
    glossy_color?: string;
    opacity?: number;
  }
): string {
  const cleanName = materialName.replace(/ /g, '');
  const kd = hexToRgb(material.base_color || '#808080');
  const ks = hexToRgb(material.glossy_color || '#000000');
  const opacity = material.opacity ?? 1.0;
  return [
    `newmtl ${cleanName}`,
    'Ns 7.843137',
    'Ka 0.000000 0.000000 0.000000',
    `Kd ${kd.r.toFixed(6)} ${kd.g.toFixed(6)} ${kd.b.toFixed(6)}`,
    `Ks ${ks.r.toFixed(6)} ${ks.g.toFixed(6)} ${ks.b.toFixed(6)}`,
    'Ni 1.500000',
    `d ${opacity.toFixed(6)}`,
    'illum 5',
    '',
  ].join('\n');
}
