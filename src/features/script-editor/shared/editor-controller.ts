import {
  parseScriptFunctions,
  findEventHandler,
  generateEventHandler,
  getEventsForItemType,
  type ParsedFunction,
  type ScriptGameItem,
} from './core';
import { parseScriptVariables, type ParsedVariable } from './vbs-api';

export interface ScriptEditorElements {
  container: HTMLElement;
  functionList: HTMLSelectElement;
  itemList: HTMLSelectElement;
  eventList: HTMLSelectElement;
  statusEl: HTMLElement;
  cursorPosEl: HTMLElement;
}

export interface ScriptEditorCallbacks {
  save: (content: string) => Promise<void>;
  onSaveSuccess?: () => void;
}

type Monaco = typeof import('monaco-editor');
type Editor = import('monaco-editor').editor.IStandaloneCodeEditor;

export class ScriptEditorController {
  private editor: Editor | null = null;
  private monaco: Monaco | null = null;
  private tableItems: ScriptGameItem[] = [];
  private parsedFunctions: ParsedFunction[] = [];
  private parsedVariables: ParsedVariable[] = [];
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private updateTimeout: ReturnType<typeof setTimeout> | null = null;
  private isTableLocked = false;
  private savedCursorPosition: { lineNumber: number; column: number } | null = null;

  constructor(
    private elements: ScriptEditorElements,
    private callbacks: ScriptEditorCallbacks
  ) {}

  createEditor(
    monaco: Monaco,
    content: string,
    theme: string,
    cursorPosition?: { lineNumber: number; column: number }
  ): void {
    this.monaco = monaco;
    const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';

    this.editor = monaco.editor.create(this.elements.container, {
      value: content,
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

    this.editor.onDidChangeModelContent(() => {
      this.scheduleAutoSave();
      if (this.updateTimeout) clearTimeout(this.updateTimeout);
      this.updateTimeout = setTimeout(() => this.updateFunctionList(), 500);
    });

    this.editor.onDidChangeCursorPosition(e => {
      this.elements.cursorPosEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });

    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveScript();
    });

    const pos = cursorPosition || this.savedCursorPosition;
    if (pos) {
      this.editor.setPosition(pos);
      this.editor.revealLineInCenter(pos.lineNumber);
    }

    this.editor.focus();
    this.setStatus('Ready');
    this.updateFunctionList();
  }

  setupSelectListeners(): void {
    this.elements.itemList.addEventListener('change', e => {
      const selectedOption = (e.target as HTMLSelectElement).selectedOptions[0];
      const itemType = selectedOption?.dataset?.type || '';
      this.updateEventList(itemType);
    });

    this.elements.eventList.addEventListener('change', e => {
      const itemName = this.elements.itemList.value;
      const eventName = (e.target as HTMLSelectElement).value;
      if (itemName && eventName) {
        this.goToOrCreateEventHandler(itemName, eventName);
        (e.target as HTMLSelectElement).value = '';
      }
    });

    this.elements.functionList.addEventListener('change', e => {
      const line = parseInt((e.target as HTMLSelectElement).value, 10);
      if (this.editor && line) {
        this.editor.revealLineInCenter(line);
        this.editor.setPosition({ lineNumber: line, column: 1 });
        this.editor.focus();
      }
    });
  }

  populateItemList(items: ScriptGameItem[]): void {
    this.tableItems = items || [];
    this.elements.itemList.innerHTML = '<option value="">(All Items)</option>';
    const sortedItems = [...this.tableItems].sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sortedItems) {
      const opt = document.createElement('option');
      opt.value = item.name;
      opt.dataset.type = item.type;
      opt.textContent = item.name;
      this.elements.itemList.appendChild(opt);
    }
  }

  setTableLocked(locked: boolean): void {
    this.isTableLocked = locked;
    if (this.editor) {
      this.editor.updateOptions({ readOnly: locked });
    }
    this.setStatus(locked ? 'Table is locked (read-only)' : 'Ready');
  }

  setTheme(theme: string): void {
    if (this.monaco) {
      this.monaco.editor.setTheme(theme === 'light' ? 'vs' : 'vs-dark');
    }
  }

  setContent(content: string): void {
    if (!this.editor) return;
    const position = this.editor.getPosition();
    this.editor.setValue(content);
    if (position) {
      this.editor.setPosition(position);
    }
    this.setStatus('Script restored from undo');
  }

  getEditor(): Editor | null {
    return this.editor;
  }

  getCursorPosition(): { lineNumber: number; column: number } | null {
    const pos = this.editor?.getPosition();
    if (!pos) return null;
    return { lineNumber: pos.lineNumber, column: pos.column };
  }

  getCompletionState(): {
    tableItems: ScriptGameItem[];
    parsedFunctions: ParsedFunction[];
    parsedVariables: ParsedVariable[];
  } {
    return {
      tableItems: this.tableItems,
      parsedFunctions: this.parsedFunctions,
      parsedVariables: this.parsedVariables,
    };
  }

  async flushPendingSave(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
      await this.saveScript();
    }
  }

  saveCursorAndDispose(): void {
    if (this.editor) {
      const pos = this.editor.getPosition();
      if (pos) {
        this.savedCursorPosition = { lineNumber: pos.lineNumber, column: pos.column };
      }
      this.editor.dispose();
      this.editor = null;
    }
  }

  dispose(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    if (this.updateTimeout) clearTimeout(this.updateTimeout);
    this.saveTimeout = null;
    this.updateTimeout = null;
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }

  private updateFunctionList(): void {
    if (!this.editor) return;
    const code = this.editor.getValue();
    this.parsedFunctions = parseScriptFunctions(code);
    this.parsedVariables = parseScriptVariables(code);
    this.elements.functionList.innerHTML = '<option value="">(Select Function)</option>';
    for (const fn of this.parsedFunctions) {
      const opt = document.createElement('option');
      opt.value = String(fn.line);
      opt.textContent = fn.name;
      this.elements.functionList.appendChild(opt);
    }
  }

  private updateEventList(itemType: string): void {
    this.elements.eventList.innerHTML = '<option value="">(Select Event)</option>';
    const events = getEventsForItemType(itemType);
    for (const event of events) {
      const opt = document.createElement('option');
      opt.value = event;
      opt.textContent = '_' + event;
      this.elements.eventList.appendChild(opt);
    }
  }

  private goToOrCreateEventHandler(itemName: string, eventName: string): void {
    if (!this.editor || !this.monaco || !itemName || !eventName) return;

    const code = this.editor.getValue();
    const result = findEventHandler(code, itemName, eventName);

    if (result.found) {
      this.editor.revealLineInCenter(result.line);
      this.editor.setPosition({ lineNumber: result.line, column: 1 });
      this.editor.focus();
      return;
    }

    if (this.isTableLocked) return;

    const newSub = generateEventHandler(itemName, eventName);
    const model = this.editor.getModel()!;
    const lastLine = model.getLineCount();
    model.applyEdits([
      {
        range: new this.monaco.Range(
          lastLine,
          model.getLineMaxColumn(lastLine),
          lastLine,
          model.getLineMaxColumn(lastLine)
        ),
        text: newSub,
      },
    ]);
    this.editor.revealLineInCenter(lastLine + 2);
    this.editor.setPosition({ lineNumber: lastLine + 2, column: 2 });
    this.editor.focus();
  }

  private scheduleAutoSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveScript();
    }, 500);
  }

  private async saveScript(): Promise<void> {
    if (!this.editor) return;
    const content = this.editor.getValue();
    try {
      await this.callbacks.save(content);
      this.setStatus('Saved');
      this.callbacks.onSaveSuccess?.();
    } catch (error) {
      this.setStatus(`Save failed: ${error}`);
    }
  }

  private setStatus(msg: string): void {
    this.elements.statusEl.textContent = msg;
  }
}
