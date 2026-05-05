export interface MeshImportOptions {
  convertCoords: boolean;
  centerMesh: boolean;
  importMaterial: boolean;
  absolutePosition: boolean;
}

export interface MeshImportBrowseResult {
  path: string;
  content: string;
  extras?: Map<string, string>;
}

export interface MeshImportCallbacks {
  onBrowse: () => Promise<MeshImportBrowseResult | null>;
  onImport: (filePath: string, content: string, options: MeshImportOptions, extras?: Map<string, string>) => void;
  onCancel: () => void;
}

export function createMeshImportHTML(): string {
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
          <label><input type="checkbox" id="mesh-import-convert-coords" checked> Convert coordinate system</label>
          <label><input type="checkbox" id="mesh-import-center-mesh"> Center mesh to it's midpoint</label>
          <label><input type="checkbox" id="mesh-import-material"> Import mesh's material</label>
          <div></div>
          <label class="full-width"><input type="radio" name="mesh-position" id="mesh-import-rel-position" checked> Place at primitive's position</label>
          <label class="full-width"><input type="radio" name="mesh-position" id="mesh-import-abs-position"> Place at mesh's absolute position (use mesh's midpoint)</label>
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

  const convertCoordsCheck = container.querySelector('#mesh-import-convert-coords') as HTMLInputElement;
  const centerMeshCheck = container.querySelector('#mesh-import-center-mesh') as HTMLInputElement;
  const materialCheck = container.querySelector('#mesh-import-material') as HTMLInputElement;
  const absPositionRadio = container.querySelector('#mesh-import-abs-position') as HTMLInputElement;

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
    }
  };

  const handleImport = () => {
    if (!selectedFilePath || !selectedFileContent) return;

    const options: MeshImportOptions = {
      convertCoords: convertCoordsCheck.checked,
      centerMesh: centerMeshCheck.checked,
      importMaterial: materialCheck.checked,
      absolutePosition: absPositionRadio.checked,
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

interface FaceCorner {
  v: number;
  t: number;
  n: number;
}

export interface ParsedMesh {
  vertices: { x: number; y: number; z: number }[];
  normals: { x: number; y: number; z: number }[];
  texCoords: { u: number; v: number }[];
  faces: FaceCorner[][];
  midPoint: { x: number; y: number; z: number };
}

export function parseObjContent(content: string, convertCoords: boolean): ParsedMesh {
  const lines = content.split('\n');
  const vertices: { x: number; y: number; z: number }[] = [];
  const normals: { x: number; y: number; z: number }[] = [];
  const texCoords: { u: number; v: number }[] = [];
  const faces: FaceCorner[][] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    // Z is pre-flipped only when convertCoords is off, to cancel vpin's reader-side z-negation
    // (vpin/src/vpx/obj.rs unconditionally negates obj_z to vpx_z). When convertCoords is on,
    // pass z through and let vpin's flip do the right-handed -> vpinball-runtime conversion.
    if (parts[0] === 'v' && parts.length >= 4) {
      let x = parseFloat(parts[1]) || 0;
      let y = parseFloat(parts[2]) || 0;
      let z = parseFloat(parts[3]) || 0;
      if (!convertCoords) {
        z = -z;
      }
      vertices.push({ x, y, z });
    } else if (parts[0] === 'vn' && parts.length >= 4) {
      let nx = parseFloat(parts[1]) || 0;
      let ny = parseFloat(parts[2]) || 0;
      let nz = parseFloat(parts[3]) || 0;
      if (!convertCoords) {
        nz = -nz;
      }
      normals.push({ x: nx, y: ny, z: nz });
    } else if (parts[0] === 'vt' && parts.length >= 3) {
      const u = parseFloat(parts[1]) || 0;
      let v = parseFloat(parts[2]) || 0;
      if (convertCoords) {
        v = 1 - v;
      }
      texCoords.push({ u, v });
    } else if (parts[0] === 'f') {
      if (vertices.length === 0) {
        throw new Error('No vertices found in obj file, import is impossible!');
      }
      if (texCoords.length === 0) {
        throw new Error('No texture coordinates (UVs) found in obj file, import is impossible!');
      }
      if (normals.length === 0) {
        throw new Error('No normals found in obj file, import is impossible!');
      }
      const corners: FaceCorner[] = [];
      for (const cornerStr of parts.slice(1)) {
        const indices = cornerStr.split('/');
        const vi = parseInt(indices[0], 10);
        const ti = indices[1] ? parseInt(indices[1], 10) : NaN;
        const ni = indices[2] ? parseInt(indices[2], 10) : NaN;
        if (isNaN(vi) || isNaN(ti) || isNaN(ni)) {
          throw new Error('Face information incorrect! Each face needs vertices, UVs and normals!');
        }
        corners.push({ v: vi, t: ti, n: ni });
      }
      if (corners.length < 3) {
        throw new Error('Invalid face -- less than 3 vertices!');
      }
      if (convertCoords) corners.reverse();
      faces.push(corners);
    }
  }

  let midPoint = { x: 0, y: 0, z: 0 };
  if (vertices.length > 0) {
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    for (const v of vertices) {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z);
      maxZ = Math.max(maxZ, v.z);
    }
    midPoint = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    };
  }

  return { vertices, normals, texCoords, faces, midPoint };
}

export function generateProcessedObj(
  mesh: ParsedMesh,
  options: { centerMesh: boolean; absolutePosition: boolean }
): string {
  const { vertices, normals, texCoords, faces, midPoint } = mesh;
  const shift = options.centerMesh || options.absolutePosition;

  interface CombinedSlot {
    x: number;
    y: number;
    z: number;
    u: number;
    tv: number;
    nx: number;
    ny: number;
    nz: number;
  }
  const slotMap = new Map<string, number>();
  const slots: CombinedSlot[] = [];

  const getSlot = (corner: FaceCorner): number => {
    const v = vertices[corner.v - 1];
    if (!v) {
      throw new Error(`Face references vertex ${corner.v}, but only ${vertices.length} are defined`);
    }
    const t = texCoords[corner.t - 1];
    if (!t) {
      throw new Error(`Face references texture coordinate ${corner.t}, but only ${texCoords.length} are defined`);
    }
    const n = normals[corner.n - 1];
    if (!n) {
      throw new Error(`Face references normal ${corner.n}, but only ${normals.length} are defined`);
    }
    const key = `${corner.v}/${corner.t}/${corner.n}`;
    const existing = slotMap.get(key);
    if (existing !== undefined) return existing;

    const slot = slots.length + 1;
    slots.push({
      x: shift ? v.x - midPoint.x : v.x,
      y: shift ? v.y - midPoint.y : v.y,
      z: shift ? v.z - midPoint.z : v.z,
      u: t.u,
      tv: t.v,
      nx: n.x,
      ny: n.y,
      nz: n.z,
    });
    slotMap.set(key, slot);
    return slot;
  };

  const triangles: [number, number, number][] = [];
  for (const face of faces) {
    const a = getSlot(face[0]);
    for (let i = 1; i < face.length - 1; i++) {
      const b = getSlot(face[i]);
      const c = getSlot(face[i + 1]);
      triangles.push([a, b, c]);
    }
  }

  const out: string[] = [];
  out.push('# Imported by VPX Editor');
  out.push('o mesh');
  for (const s of slots) out.push(`v ${s.x} ${s.y} ${s.z}`);
  for (const s of slots) out.push(`vt ${s.u} ${s.tv}`);
  for (const s of slots) out.push(`vn ${s.nx} ${s.ny} ${s.nz}`);
  for (const [a, b, c] of triangles) {
    out.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`);
  }
  return out.join('\n');
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
