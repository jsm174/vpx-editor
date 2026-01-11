import type { MenuProvider, MenuTemplate, MenuStateUpdate } from '../types.js';

export class ElectronMenuProvider implements MenuProvider {
  private get api() {
    if (typeof window !== 'undefined' && (window as any).vpxEditorAPI) {
      return (window as any).vpxEditorAPI;
    }
    return null;
  }

  setMenu(_template: MenuTemplate): void {}

  updateMenuState(updates: MenuStateUpdate): void {
    if (this.api && this.api.updateMenuState) {
      this.api.updateMenuState(updates);
    }
  }
}

export function createElectronMenuProvider(): ElectronMenuProvider {
  return new ElectronMenuProvider();
}
