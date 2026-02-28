import { parseScriptFunctions, ITEM_EVENTS, type ParsedFunction, type ScriptGameItem } from '../shared/core';
import { registerVbsCompletionProvider, parseScriptVariables, type ParsedVariable } from '../shared/vbs-api';

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
}

let editor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null;
let tableItems: ScriptGameItem[] = [];
let parsedFunctions: ParsedFunction[] = [];
let parsedVariables: ParsedVariable[] = [];
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isTableLocked = false;

function setTableLocked(locked: boolean): void {
  isTableLocked = locked;
  if (editor) {
    editor.updateOptions({ readOnly: locked });
  }
  setStatus(locked ? 'Table is locked (read-only)' : 'Ready');
}

function setStatus(msg: string): void {
  document.getElementById('status')!.textContent = msg;
}

function updateFunctionList(): void {
  if (!editor) return;
  const code = editor.getValue();
  parsedFunctions = parseScriptFunctions(code);
  parsedVariables = parseScriptVariables(code);
  const select = document.getElementById('function-list') as HTMLSelectElement;
  select.innerHTML = '<option value="">(Select Function)</option>';
  for (const fn of parsedFunctions) {
    const opt = document.createElement('option');
    opt.value = String(fn.line);
    opt.textContent = fn.name;
    select.appendChild(opt);
  }
}

function populateItemList(items: ScriptGameItem[]): void {
  tableItems = items || [];
  const select = document.getElementById('item-list') as HTMLSelectElement;
  select.innerHTML = '<option value="">(All Items)</option>';
  const sortedItems = [...tableItems].sort((a, b) => a.name.localeCompare(b.name));
  for (const item of sortedItems) {
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.dataset.type = item.type;
    opt.textContent = item.name;
    select.appendChild(opt);
  }
}

function updateEventList(itemType: string): void {
  const select = document.getElementById('event-list') as HTMLSelectElement;
  select.innerHTML = '<option value="">(Select Event)</option>';
  const events = ITEM_EVENTS[itemType] || [];
  for (const event of events) {
    const opt = document.createElement('option');
    opt.value = event;
    opt.textContent = '_' + event;
    select.appendChild(opt);
  }
}

function goToOrCreateEventHandler(itemName: string, eventName: string): void {
  if (!editor || !itemName || !eventName) return;
  const { monaco } = window;
  const subName = `${itemName}_${eventName}`;
  const code = editor.getValue();
  const regex = new RegExp(`^\\s*sub\\s+${subName}\\s*\\(?`, 'im');
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      editor.revealLineInCenter(i + 1);
      editor.setPosition({ lineNumber: i + 1, column: 1 });
      editor.focus();
      return;
    }
  }
  if (isTableLocked) return;
  const newSub = `\nSub ${subName}()\n\t\nEnd Sub\n`;
  const model = editor.getModel()!;
  const lastLine = model.getLineCount();
  model.applyEdits([
    {
      range: new monaco.Range(lastLine, model.getLineMaxColumn(lastLine), lastLine, model.getLineMaxColumn(lastLine)),
      text: newSub,
    },
  ]);
  editor.revealLineInCenter(lastLine + 2);
  editor.setPosition({ lineNumber: lastLine + 2, column: 2 });
  editor.focus();
}

async function saveScript(): Promise<void> {
  if (!editor) return;
  const content = editor.getValue();
  const result = await window.scriptEditor.saveScript(content);
  if (result.success) {
    setStatus('Saved');
    window.scriptEditor.notifyScriptChanged();
  } else {
    setStatus(`Save failed: ${result.error}`);
  }
}

function scheduleAutoSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveScript();
  }, 500);
}

window.require.config({
  paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' },
});

window.require(['vs/editor/editor.main'], () => {
  const { monaco } = window;

  registerVbsCompletionProvider(monaco, () => ({
    tableItems,
    parsedFunctions,
    parsedVariables,
  }));

  window.scriptEditor.onInit((data: InitData) => {
    const initialContent = data.script || '';
    document.title = data.tableName ? `Script Editor - [${data.tableName}.vpx]` : 'Script Editor';

    if (data.gameitems) {
      populateItemList(data.gameitems);
    }

    if (data.theme) {
      document.documentElement.setAttribute('data-theme', data.theme);
    }

    const container = document.getElementById('editor-container')!;
    const monacoTheme = data.theme === 'light' ? 'vs' : 'vs-dark';

    editor = monaco.editor.create(container, {
      value: initialContent,
      language: 'vb',
      theme: monacoTheme,
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'Consolas', 'Monaco', 'Menlo', monospace",
      lineNumbers: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      tabSize: 4,
      insertSpaces: false,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
    });

    let updateTimeout: ReturnType<typeof setTimeout> | null = null;
    editor.onDidChangeModelContent(() => {
      scheduleAutoSave();
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(updateFunctionList, 500);
    });

    editor.onDidChangeCursorPosition(e => {
      document.getElementById('cursor-pos')!.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveScript();
    });

    if (data.isLocked) {
      setTableLocked(true);
    } else {
      setStatus('Ready');
    }
    updateFunctionList();
  });

  window.scriptEditor.onThemeChanged((theme: string) => {
    document.documentElement.setAttribute('data-theme', theme);
    if (editor) {
      monaco.editor.setTheme(theme === 'light' ? 'vs' : 'vs-dark');
    }
  });

  window.scriptEditor.onTableLockChanged((locked: boolean) => {
    setTableLocked(locked);
  });

  window.scriptEditor.onScriptUndone((content: string) => {
    if (editor) {
      const position = editor.getPosition();
      editor.setValue(content);
      if (position) {
        editor.setPosition(position);
      }
      setStatus('Script restored from undo');
    }
  });
});

document.getElementById('item-list')!.addEventListener('change', e => {
  const selectedOption = (e.target as HTMLSelectElement).selectedOptions[0];
  const itemType = selectedOption?.dataset?.type || '';
  updateEventList(itemType);
});

document.getElementById('event-list')!.addEventListener('change', e => {
  const itemName = (document.getElementById('item-list') as HTMLSelectElement).value;
  const eventName = (e.target as HTMLSelectElement).value;
  if (itemName && eventName) {
    goToOrCreateEventHandler(itemName, eventName);
    (e.target as HTMLSelectElement).value = '';
  }
});

document.getElementById('function-list')!.addEventListener('change', e => {
  const line = parseInt((e.target as HTMLSelectElement).value, 10);
  if (editor && line) {
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
  }
});

window.scriptEditor.onCheckCanClose(async () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    await saveScript();
  }
  window.scriptEditor.respondCanClose(true);
});
