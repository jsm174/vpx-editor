import {
  createMeshImportHTML,
  initMeshImportComponent,
  generateMtlContent,
  parseMtlContent,
  type MeshImportOptions,
} from '../shared/component';
import type { StorageProvider, VpxEngine } from '../../../platform/types';
import { loadObjImportOptions, saveObjImportOptions } from '../../mesh-export/web/component';
import {
  defaultExchange,
  insertObjHeaderComment,
  isIdentityExchange,
  exportMeshIoOptions,
  importMeshIoOptions,
  type ObjExchangeOptions,
} from '../../../shared/obj-transform';
import { UNIT_CONVERSION_VPU } from '../../../shared/constants';
import templateHtml from './template.html?raw';

let templateInjected = false;

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
  storage: StorageProvider;
  fileSystem: {
    readFile: (path: string) => Promise<{ success: boolean; content?: string }>;
    writeFile: (path: string, content: string) => Promise<unknown>;
    writeBinaryFile: (path: string, content: Uint8Array) => Promise<unknown>;
  };
  vpxEngine: VpxEngine;
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
  let pendingResolve: ((result: { success: boolean; cancelled?: boolean }) => void) | null = null;

  function resolvePending(result: { success: boolean; cancelled?: boolean }): void {
    if (pendingResolve) {
      pendingResolve(result);
      pendingResolve = null;
    }
  }

  function closeModal(cancelled: boolean): void {
    modal.classList.add('hidden');
    componentInstance?.destroy();
    componentInstance = null;
    resolvePending(cancelled ? { success: false, cancelled: true } : { success: true });
  }

  closeBtn.addEventListener('click', () => closeModal(true));

  async function showMeshImport(
    primitiveFileName: string,
    resolve?: (result: { success: boolean; cancelled?: boolean }) => void
  ): Promise<void> {
    const EXTRACTED_DIR = deps.getExtractedDir();
    if (!EXTRACTED_DIR) {
      resolve?.({ success: false, cancelled: true });
      return;
    }

    pendingResolve = resolve ?? null;
    currentPrimitiveFileName = primitiveFileName;
    body.innerHTML = createMeshImportHTML(await loadObjImportOptions(deps.storage));

    componentInstance = initMeshImportComponent(body as HTMLElement, {
      onBrowse: async () => {
        return new Promise(resolve => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.obj,.mtl';
          input.multiple = true;
          input.onchange = async () => {
            const files = input.files ? Array.from(input.files) : [];
            const objFile = files.find(f => f.name.toLowerCase().endsWith('.obj'));
            if (!objFile) {
              deps.events.emit('status', 'Selection must include a .obj file');
              resolve(null);
              return;
            }
            const content = await objFile.text();
            const extras = new Map<string, string>();
            for (const file of files) {
              if (file === objFile) continue;
              extras.set(file.name, await file.text());
            }
            resolve({ path: objFile.name, content, header: content.slice(0, 1024), extras });
          };
          input.click();
        });
      },
      onImport: async (filePath: string, content: string, options: MeshImportOptions, extras?: Map<string, string>) => {
        const extractedDir = deps.getExtractedDir();
        if (!extractedDir) return;

        try {
          const destFileName = currentPrimitiveFileName.replace('.json', '.obj');

          const bytes = new TextEncoder().encode(content);
          const exchange = defaultExchange(options.unit ?? UNIT_CONVERSION_VPU, options.orientation);
          await saveObjImportOptions(deps.storage, exchange);
          const mesh = deps.vpxEngine.objToMesh(bytes, importMeshIoOptions(exchange));
          const midpoint = mesh.midpoint;

          let positions = mesh.positions;
          if (options.centerMesh || options.absolutePosition) {
            const shifted = new Float32Array(positions.length);
            for (let i = 0; i < positions.length; i += 3) {
              shifted[i] = positions[i] - midpoint[0];
              shifted[i + 1] = positions[i + 1] - midpoint[1];
              shifted[i + 2] = positions[i + 2] - midpoint[2];
            }
            positions = shifted;
          }

          const processedBytes = deps.vpxEngine.meshToObj(
            'mesh',
            positions,
            mesh.texCoords,
            mesh.normals,
            mesh.indices,
            null
          );

          await deps.fileSystem.writeBinaryFile(`${extractedDir}/${destFileName}`, processedBytes);

          let importedMaterialName: string | null = null;
          if (options.importMaterial && extras) {
            const objBase = filePath.replace(/\.obj$/i, '');
            const mtlContent =
              extras.get(`${objBase}.mtl`) ||
              extras.get(`${objBase}.MTL`) ||
              [...extras.entries()].find(([name]) => name.toLowerCase().endsWith('.mtl'))?.[1];
            if (mtlContent) {
              const material = parseMtlContent(mtlContent);
              if (material) {
                const materialsResult = await deps.fileSystem.readFile(`${extractedDir}/materials.json`);
                let materials: { name: string }[] = [];
                if (materialsResult.success && materialsResult.content) {
                  materials = JSON.parse(materialsResult.content);
                }
                if (!materials.find(m => m.name === material.name)) {
                  materials.push(material);
                  await deps.fileSystem.writeFile(`${extractedDir}/materials.json`, JSON.stringify(materials, null, 2));
                }
                importedMaterialName = material.name;
              }
            } else {
              deps.events.emit('status', 'No .mtl file selected; material not imported');
            }
          }

          const primContent = await deps.fileSystem.readFile(`${extractedDir}/${currentPrimitiveFileName}`);
          if (primContent.success && primContent.content) {
            const primData = JSON.parse(primContent.content);
            const primType = Object.keys(primData)[0];
            const prim = primData[primType];

            prim.use_3d_mesh = true;

            if (options.absolutePosition) {
              prim.position = { x: midpoint[0], y: midpoint[1], z: midpoint[2] };
              prim.size = { x: 1, y: 1, z: 1 };
            }

            if (importedMaterialName) {
              prim.material = importedMaterialName;
            }

            await deps.fileSystem.writeFile(
              `${extractedDir}/${currentPrimitiveFileName}`,
              JSON.stringify(primData, null, 2)
            );
          }

          deps.events.emit('mesh-imported', { primitiveFileName: currentPrimitiveFileName, options });

          closeModal(false);
        } catch (err) {
          console.error('Mesh import failed:', err);
          deps.events.emit('status', `Mesh import failed: ${(err as Error).message}`);
          closeModal(true);
        }
      },
      onCancel: () => closeModal(true),
    });

    modal.classList.remove('hidden');
  }

  deps.events.on('show-mesh-import', (...args: unknown[]) => {
    const fileName = args[0] as string;
    const resolve = args[1] as ((result: { success: boolean; cancelled?: boolean }) => void) | undefined;
    showMeshImport(fileName, resolve);
  });

  deps.events.on('export-mesh', async (...args: unknown[]) => {
    const primitiveFileName = args[0] as string;
    const exchange = defaultExchange(
      (args[2] as ObjExchangeOptions | undefined)?.unit ?? UNIT_CONVERSION_VPU,
      (args[2] as ObjExchangeOptions | undefined)?.orientation
    );
    const extractedDir = deps.getExtractedDir();
    if (!extractedDir) return;

    try {
      const srcFileName = primitiveFileName.replace('.json', '.obj');
      const srcPath = `${extractedDir}/${srcFileName}`;

      const fileResult = await deps.fileSystem.readFile(srcPath);
      let objContent = fileResult.success ? fileResult.content : null;

      if (objContent && !isIdentityExchange(exchange)) {
        const mesh = deps.vpxEngine.objToMesh(new TextEncoder().encode(objContent), null);
        objContent = new TextDecoder().decode(
          deps.vpxEngine.meshToObj(
            mesh.name || 'mesh',
            mesh.positions,
            mesh.texCoords,
            mesh.normals,
            mesh.indices,
            exportMeshIoOptions(exchange)
          )
        );
      }

      if (!objContent) {
        const jsonPath = `${extractedDir}/${primitiveFileName}`;
        const jsonResult = await deps.fileSystem.readFile(jsonPath);
        if (jsonResult.success && jsonResult.content) {
          try {
            const itemData = JSON.parse(jsonResult.content);
            const prim = itemData.Primitive;
            if (prim && !prim.use_3d_mesh) {
              const mesh = deps.vpxEngine.generateBuiltinPrimitive(prim.sides ?? 4, !!prim.draw_textures_inside);
              const objBytes = deps.vpxEngine.meshToObj(
                prim.name || 'primitive',
                mesh.positions,
                mesh.texCoords,
                mesh.normals,
                mesh.indices,
                exportMeshIoOptions(exchange)
              );
              objContent = new TextDecoder().decode(objBytes);
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
              mtlContent = generateMtlContent(
                materialName!,
                mat as { base_color?: string; glossy_color?: string; opacity?: number }
              );
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

      downloadFile(insertObjHeaderComment(objContent, exchange), baseName);
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
