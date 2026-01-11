import { initDimensionsManagerComponent, type DimensionsManagerInstance } from '../shared/component';
import { parseTableSizesCSV, type PredefinedTable } from '../shared/table-sizes';
import type { GameData } from '../../../types/data';
import templateHtml from './template.html?raw';

export type { DimensionsManagerInstance };

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

export interface WebDimensionsManagerDeps {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  onGamedataChanged: () => void;
}

export interface WebDimensionsManagerInstance {
  open: (extractedDir: string) => Promise<void>;
  close: () => void;
  setTheme: (theme: string) => void;
}

async function loadTableSizes(): Promise<PredefinedTable[]> {
  try {
    const base = import.meta.env.BASE_URL || './';
    const response = await fetch(`${base}assets/TableSizes.csv`);
    if (!response.ok) return [];
    const csvContent = await response.text();
    return parseTableSizesCSV(csvContent);
  } catch {
    return [];
  }
}

export function initWebDimensionsManager(
  deps: WebDimensionsManagerDeps,
  resolveTheme: (theme?: string) => string,
  getThemeFromSettings: () => Promise<string | undefined>
): WebDimensionsManagerInstance {
  injectTemplate();
  const modal = document.getElementById('dimensions-modal')!;
  const closeBtn = document.getElementById('dimensions-close')!;

  let dimensionsInstance: DimensionsManagerInstance | null = null;
  let currentExtractedDir: string = '';
  let cachedTables: PredefinedTable[] | null = null;

  async function open(extractedDir: string): Promise<void> {
    currentExtractedDir = extractedDir;

    const themeSetting = await getThemeFromSettings();
    const theme = resolveTheme(themeSetting);
    modal.setAttribute('data-theme', theme);

    let gamedata: GameData = {};

    try {
      const gamedataJson = await deps.readFile(`${extractedDir}/gamedata.json`);
      gamedata = JSON.parse(gamedataJson);
    } catch {
      /* empty */
    }

    if (!dimensionsInstance) {
      if (!cachedTables) {
        cachedTables = await loadTableSizes();
      }

      const elements = {
        tableBody: document.getElementById('dimensions-table-body') as HTMLTableSectionElement,
        tableHeaders: document.querySelectorAll('#dimensions-table th'),
        refWidthIn: document.getElementById('dim-ref-width-in') as HTMLInputElement,
        refHeightIn: document.getElementById('dim-ref-height-in') as HTMLInputElement,
        refWidthVp: document.getElementById('dim-ref-width-vp') as HTMLInputElement,
        refHeightVp: document.getElementById('dim-ref-height-vp') as HTMLInputElement,
        refGlassTop: document.getElementById('dim-ref-glass-top') as HTMLInputElement,
        refGlassBottom: document.getElementById('dim-ref-glass-bottom') as HTMLInputElement,
        refAspectRatio: document.getElementById('dim-ref-aspect-ratio') as HTMLElement,
        curWidthIn: document.getElementById('dim-cur-width-in') as HTMLInputElement,
        curHeightIn: document.getElementById('dim-cur-height-in') as HTMLInputElement,
        curWidthVp: document.getElementById('dim-cur-width-vp') as HTMLInputElement,
        curHeightVp: document.getElementById('dim-cur-height-vp') as HTMLInputElement,
        curGlassTop: document.getElementById('dim-cur-glass-top') as HTMLInputElement,
        curGlassBottom: document.getElementById('dim-cur-glass-bottom') as HTMLInputElement,
        curAspectRatio: document.getElementById('dim-cur-aspect-ratio') as HTMLElement,
        copyBtn: document.getElementById('dim-copy-btn') as HTMLButtonElement,
        closeBtn: document.getElementById('dim-close-btn') as HTMLButtonElement,
        applyBtn: document.getElementById('dim-apply-btn') as HTMLButtonElement,
      };

      dimensionsInstance = initDimensionsManagerComponent(
        elements,
        {
          onApply: async data => {
            const gamedataJson = await deps.readFile(`${currentExtractedDir}/gamedata.json`);
            const currentGamedata = JSON.parse(gamedataJson);
            currentGamedata.right = data.width;
            currentGamedata.bottom = data.height;
            currentGamedata.glass_top_height = data.glassTop;
            currentGamedata.glass_bottom_height = data.glassBottom;
            await deps.writeFile(`${currentExtractedDir}/gamedata.json`, JSON.stringify(currentGamedata, null, 2));
            deps.onGamedataChanged();
          },
          onClose: close,
        },
        cachedTables
      );
    }

    dimensionsInstance.setData(gamedata);
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
