import {
  initDimensionsManagerComponent,
  type DimensionsManagerElements,
  type DimensionsManagerInstance,
  type PredefinedTable,
} from '../shared/component';

declare const window: Window & {
  dimensionsManager?: {
    onInit: (
      callback: (data: { gamedata?: Record<string, unknown>; theme?: string; tables?: PredefinedTable[] }) => void
    ) => void;
    onThemeChanged: (callback: (theme: string) => void) => void;
    onSetDisabled: (callback: (disabled: boolean) => void) => void;
    applyDimensions: (data: { width: number; height: number; glassTop: number; glassBottom: number }) => Promise<void>;
    close: () => void;
  };
};

let component: DimensionsManagerInstance | null = null;

function getElements(): DimensionsManagerElements {
  return {
    tableBody: document.querySelector('#dimensions-table tbody') as HTMLTableSectionElement,
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
}

function init(): void {
  if (window.dimensionsManager) {
    window.dimensionsManager.onInit(data => {
      if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);

      if (!component) {
        component = initDimensionsManagerComponent(
          getElements(),
          {
            onApply: async dims => {
              await window.dimensionsManager!.applyDimensions(dims);
            },
            onClose: () => {
              window.dimensionsManager!.close();
            },
          },
          data.tables || []
        );
      }

      component.setData(data.gamedata || {});
    });

    window.dimensionsManager.onThemeChanged(theme => {
      document.documentElement.setAttribute('data-theme', theme);
    });

    window.dimensionsManager.onSetDisabled(disabled => {
      component?.setUIDisabled(disabled);
    });
  }
}

init();
