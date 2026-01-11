import {
  initRenderProbeManagerComponent,
  type RenderProbeManagerInstance,
  type RenderProbe,
} from '../shared/component';
import { initWebPrompt } from '../../prompt/web/component';
import templateHtml from './template.html?raw';

export type { RenderProbeManagerInstance, RenderProbe };

export interface WebRenderProbeManagerDeps {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  onRenderProbesChanged: () => void;
}

export interface WebRenderProbeManagerInstance {
  open: (extractedDir: string) => Promise<void>;
  close: () => void;
  setTheme: (theme: string) => void;
}

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

export function initWebRenderProbeManager(
  deps: WebRenderProbeManagerDeps,
  resolveTheme: (theme?: string) => string,
  getThemeFromSettings: () => Promise<string | undefined>
): WebRenderProbeManagerInstance {
  injectTemplate();

  const modal = document.getElementById('render-probe-modal')!;
  const closeBtn = document.getElementById('render-probe-close')!;
  const prompt = initWebPrompt();

  let renderProbeInstance: RenderProbeManagerInstance | null = null;
  let currentExtractedDir: string = '';

  async function open(extractedDir: string): Promise<void> {
    currentExtractedDir = extractedDir;

    const themeSetting = await getThemeFromSettings();
    const theme = resolveTheme(themeSetting);
    modal.setAttribute('data-theme', theme);

    let probes: Record<string, RenderProbe> = {};

    try {
      const probesJson = await deps.readFile(`${extractedDir}/renderprobes.json`);
      const probesArray = JSON.parse(probesJson) as RenderProbe[];
      for (const probe of probesArray) {
        if (probe.name) probes[probe.name] = probe;
      }
    } catch {
      /* empty */
    }

    if (!renderProbeInstance) {
      const elements = {
        probeList: document.getElementById('render-probe-list')!,
        propertiesContainer: document.getElementById('render-probe-properties-container')!,
        emptyState: document.getElementById('render-probe-empty-state')!,
        newBtn: document.getElementById('render-probe-new-btn')!,
        statusEl: document.getElementById('render-probe-status')!,
        typePlane: document.getElementById('rp-type-plane') as HTMLInputElement,
        typeScreen: document.getElementById('rp-type-screen') as HTMLInputElement,
        roughness: document.getElementById('rp-roughness') as HTMLInputElement,
        roughnessLabel: document.getElementById('rp-roughness-label')!,
        planeX: document.getElementById('rp-plane-x') as HTMLInputElement,
        planeY: document.getElementById('rp-plane-y') as HTMLInputElement,
        planeZ: document.getElementById('rp-plane-z') as HTMLInputElement,
        planeW: document.getElementById('rp-plane-w') as HTMLInputElement,
        reflectionMode: document.getElementById('rp-reflection-mode') as HTMLSelectElement,
        disableLightmaps: document.getElementById('rp-disable-lightmaps') as HTMLInputElement,
        contextMenu: document.getElementById('render-probe-context-menu')!,
      };

      renderProbeInstance = initRenderProbeManagerComponent(elements, {
        writeFile: (path, content) => deps.writeFile(path, content),
        onRenderProbesChanged: deps.onRenderProbesChanged,
        openRenamePrompt: (currentName: string, existingNames: string[]) => {
          prompt
            .show({
              mode: 'rename',
              entityType: 'renderprobe',
              currentName,
              existingNames,
            })
            .then(result => {
              if (result.submitted && result.value) {
                renderProbeInstance?.applyRename(currentName, result.value);
              }
            });
        },
      });
    }

    renderProbeInstance.setData({
      extractedDir: currentExtractedDir,
      probes,
    });
    renderProbeInstance.setUIDisabled(false);
    renderProbeInstance.renderList();
    document.getElementById('render-probe-status')!.textContent = `Loaded ${Object.keys(probes).length} render probes`;
    modal.classList.remove('hidden');
  }

  function close(): void {
    modal.classList.add('hidden');
  }

  closeBtn.addEventListener('click', close);

  return {
    open,
    close,
    setTheme: (theme: string) => modal.setAttribute('data-theme', theme),
  };
}
