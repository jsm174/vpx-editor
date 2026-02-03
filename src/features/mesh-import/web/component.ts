import {
  createMeshImportHTML,
  initMeshImportComponent,
  parseObjContent,
  generateProcessedObj,
  type MeshImportOptions,
} from '../shared/component';
import { builtinMeshToOBJ } from '../../../shared/builtin-primitive-mesh';
import templateHtml from './template.html?raw';

let templateInjected = false;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

function generateWebMtl(materialName: string, mat: Record<string, unknown>): string {
  const lines: string[] = [`newmtl ${materialName}`];
  const kd = hexToRgb((mat.base_color as string) || '#808080');
  lines.push(`Kd ${kd.r.toFixed(6)} ${kd.g.toFixed(6)} ${kd.b.toFixed(6)}`);
  const ks = hexToRgb((mat.glossy_color as string) || '#000000');
  lines.push(`Ks ${ks.r.toFixed(6)} ${ks.g.toFixed(6)} ${ks.b.toFixed(6)}`);
  const roughness = (mat.roughness as number) ?? 0.5;
  lines.push(`Ns ${Math.max(0, (roughness - 0.5) * 2000.0).toFixed(4)}`);
  if (mat.opacity_active && mat.opacity !== undefined && (mat.opacity as number) < 1.0) {
    lines.push(`d ${(mat.opacity as number).toFixed(6)}`);
  }
  lines.push('illum 2');
  return lines.join('\n') + '\n';
}

function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function injectTemplate(): void {
  if (templateInjected) return;
  const container = document.createElement('div');
  container.innerHTML = templateHtml;
  while (container.firstChild) {
    document.body.appendChild(container.firstChild);
  }
  templateInjected = true;
}

export interface WebMeshImportDeps {
  fileSystem: {
    readFile: (path: string) => Promise<{ success: boolean; content?: string }>;
    writeFile: (path: string, content: string) => Promise<unknown>;
  };
  events: {
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    emit: (event: string, ...args: unknown[]) => void;
  };
  getExtractedDir: () => string | null;
}

export function initWebMeshImport(deps: WebMeshImportDeps): void {
  injectTemplate();
  const modal = document.getElementById('mesh-import-modal')!;
  const body = modal.querySelector('.mesh-import-modal-body')!;
  const closeBtn = document.getElementById('mesh-import-close')!;

  let componentInstance: { destroy: () => void } | null = null;
  let currentPrimitiveFileName = '';

  function closeModal(): void {
    modal.classList.add('hidden');
    componentInstance?.destroy();
    componentInstance = null;
  }

  closeBtn.addEventListener('click', closeModal);

  async function showMeshImport(primitiveFileName: string): Promise<void> {
    const EXTRACTED_DIR = deps.getExtractedDir();
    if (!EXTRACTED_DIR) return;

    currentPrimitiveFileName = primitiveFileName;
    body.innerHTML = createMeshImportHTML();

    componentInstance = initMeshImportComponent(body as HTMLElement, {
      onBrowse: async () => {
        return new Promise(resolve => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.obj';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            const content = await file.text();
            resolve({ path: file.name, content });
          };
          input.click();
        });
      },
      onImport: async (_filePath: string, content: string, options: MeshImportOptions) => {
        const extractedDir = deps.getExtractedDir();
        if (!extractedDir) return;

        try {
          const destFileName = currentPrimitiveFileName.replace('.json', '.obj');

          const mesh = parseObjContent(content, options.convertCoords);
          const processedObj = generateProcessedObj(mesh, {
            centerMesh: options.centerMesh,
            absolutePosition: options.absolutePosition,
            convertCoords: options.convertCoords,
          });

          await deps.fileSystem.writeFile(`${extractedDir}/${destFileName}`, processedObj);

          const primContent = await deps.fileSystem.readFile(`${extractedDir}/${currentPrimitiveFileName}`);
          if (primContent.success && primContent.content) {
            const primData = JSON.parse(primContent.content);
            const primType = Object.keys(primData)[0];
            const prim = primData[primType];

            prim.use_3d_mesh = true;

            if (options.absolutePosition) {
              prim.position = { x: mesh.midPoint.x, y: mesh.midPoint.y, z: mesh.midPoint.z };
              prim.size = { x: 1, y: 1, z: 1 };
            }

            await deps.fileSystem.writeFile(
              `${extractedDir}/${currentPrimitiveFileName}`,
              JSON.stringify(primData, null, 2)
            );
          }

          deps.events.emit('mesh-imported', { primitiveFileName: currentPrimitiveFileName, options });

          closeModal();
        } catch (err) {
          console.error('Mesh import failed:', err);
        }
      },
      onCancel: closeModal,
    });

    modal.classList.remove('hidden');
  }

  deps.events.on('show-mesh-import', (fileName: unknown) => showMeshImport(fileName as string));

  deps.events.on('export-mesh', async (...args: unknown[]) => {
    const primitiveFileName = args[0] as string;
    const extractedDir = deps.getExtractedDir();
    if (!extractedDir) return;

    try {
      const srcFileName = primitiveFileName.replace('.json', '.obj');
      const srcPath = `${extractedDir}/${srcFileName}`;

      const fileResult = await deps.fileSystem.readFile(srcPath);
      let objContent = fileResult.success ? fileResult.content : null;

      if (!objContent) {
        const jsonPath = `${extractedDir}/${primitiveFileName}`;
        const jsonResult = await deps.fileSystem.readFile(jsonPath);
        if (jsonResult.success && jsonResult.content) {
          try {
            const itemData = JSON.parse(jsonResult.content);
            const prim = itemData.Primitive;
            if (prim && !prim.use_3d_mesh) {
              objContent = builtinMeshToOBJ(prim.name || 'primitive', prim.sides ?? 4, !!prim.draw_textures_inside);
            }
          } catch {
            // fall through
          }
        }
      }

      if (!objContent) {
        deps.events.emit('status', 'No mesh file found for this primitive');
        return;
      }

      let mtlContent: string | null = null;
      let materialName: string | null = null;
      try {
        const jsonPath = `${extractedDir}/${primitiveFileName}`;
        const jsonResult = await deps.fileSystem.readFile(jsonPath);
        if (jsonResult.success && jsonResult.content) {
          const itemData = JSON.parse(jsonResult.content);
          materialName = itemData.Primitive?.material || null;
        }
        if (materialName) {
          const matResult = await deps.fileSystem.readFile(`${extractedDir}/materials.json`);
          if (matResult.success && matResult.content) {
            const materials = JSON.parse(matResult.content) as { name: string }[];
            const mat = materials.find(m => m.name === materialName) as Record<string, unknown> | undefined;
            if (mat) {
              mtlContent = generateWebMtl(materialName!, mat);
            }
          }
        }
      } catch {
        // MTL generation is optional
      }

      const baseName = srcFileName
        .split('/')
        .pop()!
        .replace(/^Primitive\./, '');
      const mtlBaseName = baseName.replace('.obj', '.mtl');
      if (mtlContent && materialName) {
        const firstNewline = objContent.indexOf('\n');
        const mtlRef = `mtllib ${mtlBaseName}\nusemtl ${materialName}\n`;
        objContent = objContent.slice(0, firstNewline + 1) + mtlRef + objContent.slice(firstNewline + 1);
      }

      downloadFile(objContent, baseName);
      if (mtlContent) {
        downloadFile(mtlContent, mtlBaseName);
      }

      deps.events.emit('status', `Exported mesh: ${baseName}${mtlContent ? ` + ${mtlBaseName}` : ''}`);
    } catch (err) {
      console.error('Mesh export failed:', err);
      deps.events.emit('status', 'Mesh export failed');
    }
  });
}
