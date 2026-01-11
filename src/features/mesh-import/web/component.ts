import {
  createMeshImportHTML,
  initMeshImportComponent,
  parseObjContent,
  generateProcessedObj,
  type MeshImportOptions,
} from '../shared/component';
import templateHtml from './template.html?raw';

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
      if (!fileResult.success || !fileResult.content) {
        deps.events.emit('status', 'No mesh file found for this primitive');
        return;
      }

      const blob = new Blob([fileResult.content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = srcFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      deps.events.emit('status', `Exported mesh: ${srcFileName}`);
    } catch (err) {
      console.error('Mesh export failed:', err);
      deps.events.emit('status', 'Mesh export failed');
    }
  });
}
