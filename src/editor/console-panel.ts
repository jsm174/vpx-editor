import { showConsoleContextMenu } from './context-menu.js';
import { resizeCanvas } from './view-manager.js';
import { escapeHtml } from '../shared/window-utils.js';
import type { ConsoleSettings, ConsoleOutputData } from '../types/ipc.js';

type ConsoleLineType = 'stdout' | 'stderr' | 'info' | 'command' | 'success' | 'error' | 'warn';

const consoleOutput = document.getElementById('console-output') as HTMLElement | null;

function formatLogLine(text: string): string {
  const escaped = escapeHtml(text);
  if (/ (ERROR|FATAL) /.test(text)) return `<span class="log-error">${escaped}</span>`;
  if (/ WARN /.test(text)) return `<span class="log-warn">${escaped}</span>`;
  return escaped;
}
const consoleResizeHandle = document.getElementById('console-resize-handle') as HTMLElement | null;
const consolePanel = document.getElementById('console-panel') as HTMLElement | null;
let consolePinned = false;
let consoleResizing = false;
let consoleStartY = 0;
let consoleStartHeight = 0;

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

function clearConsole(): void {
  if (consoleOutput) {
    consoleOutput.innerHTML = '';
  }
}

function showConsole(): void {
  consolePanel?.classList.remove('hidden');
  consoleResizeHandle?.classList.remove('hidden');
  window.vpxEditor.saveConsoleSettings({ visible: true });
  setTimeout(resizeCanvas, 0);
}

function hideConsole(): void {
  consolePanel?.classList.add('hidden');
  consoleResizeHandle?.classList.add('hidden');
  window.vpxEditor.saveConsoleSettings({ visible: false });
  setTimeout(resizeCanvas, 0);
}

function appendConsoleLine(text: string, type: ConsoleLineType = 'stdout'): void {
  if (!consoleOutput) return;
  const lines = text.split('\n');
  const addTimestamp =
    type === 'info' || type === 'command' || type === 'success' || type === 'error' || type === 'warn';
  const timestamp = addTimestamp ? formatTimestamp() : null;
  const useLogLevel = type === 'stdout' || type === 'stderr';
  for (const lineText of lines) {
    if (lineText === '' && useLogLevel) continue;
    const line = document.createElement('div');
    line.className = `line ${type}`;
    if (useLogLevel) {
      line.innerHTML = formatLogLine(lineText);
    } else {
      line.textContent = timestamp ? `${timestamp}: ${lineText || ' '}` : lineText;
    }
    consoleOutput.appendChild(line);
  }
  if (!consolePinned) {
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }
}

document.getElementById('console-pin')?.addEventListener('click', () => {
  consolePinned = !consolePinned;
  document.getElementById('console-pin')?.classList.toggle('active', consolePinned);
  if (!consolePinned && consoleOutput) {
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }
});

document.getElementById('console-clear')?.addEventListener('click', () => {
  clearConsole();
});

document.getElementById('console-close')?.addEventListener('click', () => {
  hideConsole();
});

consoleOutput?.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
  showConsoleContextMenu(e.clientX, e.clientY, {
    onCopy: () => {
      const selectedText = window.getSelection()?.toString();
      if (selectedText) {
        navigator.clipboard.writeText(selectedText);
      }
    },
    onSelectAll: () => {
      const range = document.createRange();
      if (consoleOutput) {
        range.selectNodeContents(consoleOutput);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    },
    onClear: () => {
      clearConsole();
    },
  });
});

consoleResizeHandle?.addEventListener('mousedown', (e: MouseEvent) => {
  consoleResizing = true;
  consoleStartY = e.clientY;
  consoleStartHeight = consolePanel?.offsetHeight || 0;
  document.body.style.cursor = 'ns-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e: MouseEvent) => {
  if (!consoleResizing || !consolePanel) return;
  const delta = consoleStartY - e.clientY;
  const newHeight = Math.max(100, Math.min(window.innerHeight * 0.5, consoleStartHeight + delta));
  consolePanel.style.height = `${newHeight}px`;
  resizeCanvas();
});

document.addEventListener('mouseup', () => {
  if (consoleResizing && consolePanel) {
    consoleResizing = false;
    document.body.style.cursor = '';
    window.vpxEditor.saveConsoleSettings({ height: consolePanel.offsetHeight });
  }
});

window.vpxEditor.onConsoleOpen(() => {
  showConsole();
});

window.vpxEditor.onConsoleOutput((data: ConsoleOutputData) => {
  appendConsoleLine(data.text, data.type as ConsoleLineType);
});

window.vpxEditor.onToggleConsole(() => {
  if (consolePanel?.classList.contains('hidden')) {
    showConsole();
  } else {
    hideConsole();
  }
});

async function initConsole(): Promise<void> {
  const settings: ConsoleSettings | null = await window.vpxEditor.getConsoleSettings();
  if (settings && consolePanel && consoleResizeHandle) {
    if (settings.height) {
      consolePanel.style.height = `${settings.height}px`;
    }
    if (settings.visible === false) {
      consolePanel.classList.add('hidden');
      consoleResizeHandle.classList.add('hidden');
    }
  }

  const version: string = await window.vpxEditor.getVersion();
  appendConsoleLine(`VPX Editor ${version}`, 'info');
}

export { clearConsole, showConsole, hideConsole, appendConsoleLine, initConsole, consoleOutput };
