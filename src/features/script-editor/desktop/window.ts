import * as monaco from 'monaco-editor';

declare global {
  interface Window {
    scriptEditor: {
      showUnsavedChangesDialog: () => Promise<boolean>;
    };
  }
}

interface FileResult {
  success: boolean;
  content?: string;
}

interface WriteResult {
  success: boolean;
}

interface EditorElements {
  statusBar: HTMLElement | null;
}

interface EditorState {
  extractedDir: string | null;
  scriptEditorOpen: boolean;
  scriptModified: boolean;
}

const state: EditorState = {
  extractedDir: null,
  scriptEditorOpen: false,
  scriptModified: false,
};

const elements: EditorElements = {
  statusBar: null,
};

let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let originalContent: string = '';

self.MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, label: string): string {
    if (label === 'typescript' || label === 'javascript') {
      return './ts.worker.bundle.js';
    }
    return './editor.worker.bundle.js';
  },
};

export async function openScriptEditor(): Promise<void> {
  const modal = document.getElementById('script-editor-modal') as HTMLElement;
  const container = document.getElementById('script-editor-container') as HTMLElement;

  if (!state.extractedDir) {
    elements.statusBar!.textContent = 'No table loaded';
    return;
  }

  const scriptPath = `${state.extractedDir}/script.vbs`;
  const result: FileResult = await window.vpxEditor.readFile(scriptPath);

  if (!result.success) {
    elements.statusBar!.textContent = 'Failed to load script.vbs';
    return;
  }

  originalContent = result.content!;
  state.scriptEditorOpen = true;
  state.scriptModified = false;
  modal.classList.remove('hidden');

  container.innerHTML = '';

  editor = monaco.editor.create(container, {
    value: originalContent,
    language: 'vb',
    theme: 'vs-dark',
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

  editor.onDidChangeModelContent(() => {
    const modified = editor!.getValue() !== originalContent;
    if (state.scriptModified !== modified) {
      state.scriptModified = modified;
      updateScriptTitle();
    }
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    saveScript();
  });

  updateScriptTitle();
}

export async function saveScript(): Promise<void> {
  if (!editor) return;

  const content = editor.getValue();
  const scriptPath = `${state.extractedDir}/script.vbs`;

  const result: WriteResult = await window.vpxEditor.writeFile(scriptPath, content);

  if (result.success) {
    originalContent = content;
    state.scriptModified = false;
    updateScriptTitle();
    elements.statusBar!.textContent = 'Script saved';
  } else {
    elements.statusBar!.textContent = 'Failed to save script';
  }
}

export async function closeScriptEditor(): Promise<void> {
  if (state.scriptModified) {
    const discard: boolean = await window.scriptEditor.showUnsavedChangesDialog();
    if (!discard) {
      return;
    }
  }

  if (editor) {
    editor.dispose();
    editor = null;
  }

  state.scriptEditorOpen = false;
  state.scriptModified = false;
  (document.getElementById('script-editor-modal') as HTMLElement).classList.add('hidden');
}

function updateScriptTitle(): void {
  const title = document.querySelector('#script-editor-modal .modal-title') as HTMLElement | null;
  if (title) {
    title.textContent = `Script Editor - script.vbs${state.scriptModified ? ' *' : ''}`;
  }
}

export function initScriptEditor(): void {
  const saveBtn = document.getElementById('script-save') as HTMLButtonElement | null;
  const closeBtn = document.getElementById('script-close') as HTMLButtonElement | null;

  if (saveBtn) {
    saveBtn.addEventListener('click', saveScript);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeScriptEditor);
  }

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (state.scriptEditorOpen && e.key === 'Escape') {
      closeScriptEditor();
    }
  });
}
