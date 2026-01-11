export interface MeshImportOptions {
  convertCoords: boolean;
  centerMesh: boolean;
  importAnimation: boolean;
  importMaterial: boolean;
  noOptimize: boolean;
  absolutePosition: boolean;
}

export interface MeshImportCallbacks {
  onBrowse: () => Promise<{ path: string; content: string } | null>;
  onImport: (filePath: string, content: string, options: MeshImportOptions) => void;
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
          <label><input type="checkbox" id="mesh-import-animation"> Import Animation Sequence</label>
          <label><input type="checkbox" id="mesh-import-material"> Import mesh's material</label>
          <label><input type="checkbox" id="mesh-import-no-optimize"> Do not reorder/optimize data</label>
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
  const animationCheck = container.querySelector('#mesh-import-animation') as HTMLInputElement;
  const materialCheck = container.querySelector('#mesh-import-material') as HTMLInputElement;
  const noOptimizeCheck = container.querySelector('#mesh-import-no-optimize') as HTMLInputElement;
  const absPositionRadio = container.querySelector('#mesh-import-abs-position') as HTMLInputElement;

  let selectedFilePath = '';
  let selectedFileContent = '';

  const handleBrowse = async () => {
    const result = await callbacks.onBrowse();
    if (result) {
      selectedFilePath = result.path;
      selectedFileContent = result.content;
      pathInput.value = result.path;
      okBtn.disabled = false;
    }
  };

  const handleImport = () => {
    if (!selectedFilePath || !selectedFileContent) return;

    const options: MeshImportOptions = {
      convertCoords: convertCoordsCheck.checked,
      centerMesh: centerMeshCheck.checked,
      importAnimation: animationCheck.checked,
      importMaterial: materialCheck.checked,
      noOptimize: noOptimizeCheck.checked,
      absolutePosition: absPositionRadio.checked,
    };

    callbacks.onImport(selectedFilePath, selectedFileContent, options);
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

export interface ParsedMesh {
  vertices: { x: number; y: number; z: number }[];
  normals: { x: number; y: number; z: number }[];
  texCoords: { u: number; v: number }[];
  faces: string[];
  midPoint: { x: number; y: number; z: number };
}

export function parseObjContent(content: string, convertCoords: boolean): ParsedMesh {
  const lines = content.split('\n');
  const vertices: { x: number; y: number; z: number }[] = [];
  const normals: { x: number; y: number; z: number }[] = [];
  const texCoords: { u: number; v: number }[] = [];
  const faces: string[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v' && parts.length >= 4) {
      let x = parseFloat(parts[1]) || 0;
      let y = parseFloat(parts[2]) || 0;
      let z = parseFloat(parts[3]) || 0;
      if (convertCoords) {
        z = -z;
      }
      vertices.push({ x, y, z });
    } else if (parts[0] === 'vn' && parts.length >= 4) {
      let nx = parseFloat(parts[1]) || 0;
      let ny = parseFloat(parts[2]) || 0;
      let nz = parseFloat(parts[3]) || 0;
      if (convertCoords) {
        nz = -nz;
      }
      normals.push({ x: nx, y: ny, z: nz });
    } else if (parts[0] === 'vt' && parts.length >= 3) {
      const u = parseFloat(parts[1]) || 0;
      const v = parseFloat(parts[2]) || 0;
      texCoords.push({ u, v });
    } else if (parts[0] === 'f') {
      faces.push(line.trim());
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
  options: { centerMesh: boolean; absolutePosition: boolean; convertCoords: boolean }
): string {
  const { vertices, normals, texCoords, faces } = mesh;

  if (options.centerMesh || options.absolutePosition) {
    for (const v of vertices) {
      v.x -= mesh.midPoint.x;
      v.y -= mesh.midPoint.y;
      v.z -= mesh.midPoint.z;
    }
  }

  const needsTexCoords = texCoords.length === 0 && vertices.length > 0;
  if (needsTexCoords) {
    for (let i = 0; i < vertices.length; i++) {
      texCoords.push({ u: 0, v: 0 });
    }
  }

  const outputLines: string[] = [];
  outputLines.push('# Imported by VPX Editor');
  outputLines.push('o mesh');

  for (const v of vertices) {
    outputLines.push(`v ${v.x} ${v.y} ${v.z}`);
  }
  for (const vt of texCoords) {
    outputLines.push(`vt ${vt.u} ${vt.v}`);
  }
  for (const vn of normals) {
    outputLines.push(`vn ${vn.x} ${vn.y} ${vn.z}`);
  }

  for (const f of faces) {
    const parts = f.split(/\s+/);
    if (parts[0] !== 'f' || parts.length < 4) {
      outputLines.push(f);
      continue;
    }

    const faceVerts = parts.slice(1).map(vert => {
      const indices = vert.split('/');
      const vi = indices[0];
      let vti = indices[1] || '';
      const vni = indices[2] !== undefined ? indices[2] : indices[1] || '';
      if (needsTexCoords && vti === '') {
        vti = vi;
      }
      return `${vi}/${vti}/${vni}`;
    });

    if (options.convertCoords) {
      faceVerts.reverse();
    }
    outputLines.push(`f ${faceVerts.join(' ')}`);
  }

  return outputLines.join('\n');
}

export function parseMtlContent(content: string): {
  name: string;
  base_color: string;
  glossy_color: string;
  roughness: number;
  opacity: number;
} | null {
  const lines = content.split('\n');
  let material: {
    name: string;
    base_color: string;
    glossy_color: string;
    roughness: number;
    opacity: number;
  } | null = null;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'newmtl' && parts[1]) {
      material = {
        name: parts[1],
        base_color: '#808080',
        glossy_color: '#000000',
        roughness: 0.5,
        opacity: 1.0,
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
