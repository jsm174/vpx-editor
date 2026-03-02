import { registerVbsCompletionProvider } from '../shared/vbs-api';
import { ScriptEditorController } from '../shared/editor-controller';
import type { ScriptGameItem } from '../shared/core';

declare global {
  interface Window {
    scriptEditor: {
      onInit: (callback: (data: InitData) => void) => void;
      onThemeChanged: (callback: (theme: string) => void) => void;
      onTableLockChanged: (callback: (isLocked: boolean) => void) => void;
      onCheckCanClose: (callback: () => void) => void;
      onScriptUndone: (callback: (content: string) => void) => void;
      saveScript: (content: string) => Promise<{ success: boolean; error?: string }>;
      notifyScriptChanged: () => void;
      respondCanClose: (canClose: boolean) => void;
      saveCursorPosition: (position: { lineNumber: number; column: number }) => void;
    };
    require: {
      config: (options: { paths: Record<string, string> }) => void;
      (deps: string[], callback: () => void): void;
    };
    monaco: typeof import('monaco-editor');
  }
}

interface InitData {
  extractedDir: string;
  script: string;
  tableName: string;
  gameitems: ScriptGameItem[];
  theme: string;
  isLocked: boolean;
  cursorPosition?: { lineNumber: number; column: number };
}

const controller = new ScriptEditorController(
  {
    container: document.getElementById('editor-container')!,
    functionList: document.getElementById('function-list') as HTMLSelectElement,
    itemList: document.getElementById('item-list') as HTMLSelectElement,
    eventList: document.getElementById('event-list') as HTMLSelectElement,
    statusEl: document.getElementById('status')!,
    cursorPosEl: document.getElementById('cursor-pos')!,
  },
  {
    save: async (content: string) => {
      const result = await window.scriptEditor.saveScript(content);
      if (!result.success) throw new Error(result.error);
    },
    onSaveSuccess: () => window.scriptEditor.notifyScriptChanged(),
  }
);

controller.setupSelectListeners();

window.require.config({
  paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' },
});

window.require(['vs/editor/editor.main'], () => {
  const { monaco } = window;

  registerVbsCompletionProvider(monaco, () => controller.getCompletionState());

  window.scriptEditor.onInit((data: InitData) => {
    document.title = data.tableName ? `Script Editor - [${data.tableName}.vpx]` : 'Script Editor';

    if (data.gameitems) {
      controller.populateItemList(data.gameitems);
    }

    if (data.theme) {
      document.documentElement.setAttribute('data-theme', data.theme);
    }

    controller.createEditor(monaco, data.script || '', data.theme, data.cursorPosition);

    if (data.isLocked) {
      controller.setTableLocked(true);
    }
  });

  window.scriptEditor.onThemeChanged((theme: string) => {
    document.documentElement.setAttribute('data-theme', theme);
    controller.setTheme(theme);
  });

  window.scriptEditor.onTableLockChanged((locked: boolean) => {
    controller.setTableLocked(locked);
  });

  window.scriptEditor.onScriptUndone((content: string) => {
    controller.setContent(content);
  });
});

window.scriptEditor.onCheckCanClose(async () => {
  await controller.flushPendingSave();
  const position = controller.getCursorPosition();
  if (position) {
    window.scriptEditor.saveCursorPosition(position);
  }
  window.scriptEditor.respondCanClose(true);
});
