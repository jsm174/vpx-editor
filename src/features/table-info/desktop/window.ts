import { setupThemeListener } from '../../../shared/window-utils';
import { initTableInfoComponent, type TableInfoElements, type TableInfoInstance } from '../shared/component';

setupThemeListener();

let component: TableInfoInstance | null = null;

function init(): void {
  const elements: TableInfoElements = {
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
    customTableBody: document.querySelector('#table-info-custom-table tbody') as HTMLTableSectionElement,
    customTableHeaders: document.querySelectorAll('#table-info-custom-table th'),
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

  component = initTableInfoComponent(elements, {
    onSave: data => {
      window.vpxEditor.saveTableInfoWindow(data);
      window.close();
    },
    onCancel: () => {
      window.vpxEditor.cancelTableInfo();
      window.close();
    },
  });

  window.vpxEditor.onInitTableInfo?.(data => {
    component!.setData({
      info: data.info || {},
      gamedata: data.gamedata || {},
      images: data.images || [],
    });
  });
}

init();
