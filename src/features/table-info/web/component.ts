import { initTableInfoComponent, type TableInfoInstance, type TableInfoInitData } from '../shared/component';
import type { EditorSettings } from '../../../types/ipc';
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

export interface WebTableInfoDeps {
  storage: {
    get: <T>(key: string) => Promise<T | null | undefined>;
  };
  fileSystem: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
  };
  events: {
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    emit: (event: string, ...args: unknown[]) => void;
  };
  getExtractedDir: () => string | null;
  resolveTheme: (theme?: string) => string;
}

export function initWebTableInfo(deps: WebTableInfoDeps): void {
  injectTemplate();
  const modal = document.getElementById('table-info-modal')!;
  const closeBtn = document.getElementById('table-info-close')!;

  let tableInfoInstance: TableInfoInstance | null = null;

  async function openTableInfo(): Promise<void> {
    const EXTRACTED_DIR = deps.getExtractedDir();
    if (!EXTRACTED_DIR) return;

    const settings = (await deps.storage.get<EditorSettings>('editorSettings')) || {};
    const theme = deps.resolveTheme(settings.theme);
    modal.setAttribute('data-theme', theme);

    let info = {};
    let gamedata: { screen_shot?: string } = {};
    let images: { name: string }[] = [];

    try {
      const infoJson = await deps.fileSystem.readFile(`${EXTRACTED_DIR}/info.json`);
      info = JSON.parse(infoJson);
    } catch {
      /* empty */
    }

    try {
      const gamedataJson = await deps.fileSystem.readFile(`${EXTRACTED_DIR}/gamedata.json`);
      gamedata = JSON.parse(gamedataJson);
    } catch {
      /* empty */
    }

    try {
      const imagesJson = await deps.fileSystem.readFile(`${EXTRACTED_DIR}/images.json`);
      const imagesArray = JSON.parse(imagesJson);
      images = imagesArray.map((img: { name: string }) => ({ name: img.name }));
    } catch {
      /* empty */
    }

    const initData: TableInfoInitData = { info, gamedata, images };

    if (!tableInfoInstance) {
      const elements = {
        nameInput: document.getElementById('table-info-name') as HTMLInputElement,
        authorInput: document.getElementById('table-info-author') as HTMLInputElement,
        versionInput: document.getElementById('table-info-version') as HTMLInputElement,
        releaseInput: document.getElementById('table-info-release') as HTMLInputElement,
        dateSavedInput: document.getElementById('table-info-date-saved') as HTMLInputElement,
        emailInput: document.getElementById('table-info-email') as HTMLInputElement,
        websiteInput: document.getElementById('table-info-website') as HTMLInputElement,
        blurbInput: document.getElementById('table-info-blurb') as HTMLTextAreaElement,
        descriptionInput: document.getElementById('table-info-description') as HTMLTextAreaElement,
        rulesInput: document.getElementById('table-info-rules') as HTMLTextAreaElement,
        screenshotSelect: document.getElementById('table-info-screenshot') as HTMLSelectElement,
        customTableBody: document.getElementById('table-info-custom-tbody') as HTMLTableSectionElement,
        customTableHeaders: document.querySelectorAll('.table-info-custom-table th'),
        addBtn: document.getElementById('table-info-add-btn') as HTMLButtonElement,
        deleteBtn: document.getElementById('table-info-delete-btn') as HTMLButtonElement,
        okBtn: document.getElementById('table-info-ok') as HTMLButtonElement,
        cancelBtn: document.getElementById('table-info-cancel') as HTMLButtonElement,
        dialogOverlay: document.getElementById('table-info-custom-dialog') as HTMLElement,
        dialogTitle: document.getElementById('table-info-dialog-title') as HTMLElement,
        dialogNameInput: document.getElementById('table-info-dialog-name') as HTMLInputElement,
        dialogValueInput: document.getElementById('table-info-dialog-value') as HTMLInputElement,
        dialogOkBtn: document.getElementById('table-info-dialog-ok') as HTMLButtonElement,
        dialogCancelBtn: document.getElementById('table-info-dialog-cancel') as HTMLButtonElement,
      };

      tableInfoInstance = initTableInfoComponent(elements, {
        onSave: async formData => {
          const extractedDir = deps.getExtractedDir();
          if (!extractedDir) return;

          await deps.fileSystem.writeFile(`${extractedDir}/info.json`, JSON.stringify(formData.info, null, 2));

          if (formData.screenshot !== formData.originalScreenshot) {
            const gamedataJson = await deps.fileSystem.readFile(`${extractedDir}/gamedata.json`);
            const currentGamedata = JSON.parse(gamedataJson);
            currentGamedata.screen_shot = formData.screenshot || null;
            await deps.fileSystem.writeFile(`${extractedDir}/gamedata.json`, JSON.stringify(currentGamedata, null, 2));
            deps.events.emit('gamedata-changed');
          }

          deps.events.emit('info-changed');
          closeTableInfo();
        },
        onCancel: closeTableInfo,
      });
    }

    tableInfoInstance.setData(initData);
    modal.classList.remove('hidden');
  }

  function closeTableInfo(): void {
    modal.classList.add('hidden');
  }

  closeBtn.addEventListener('click', closeTableInfo);

  deps.events.on('show-table-info', openTableInfo);
}
