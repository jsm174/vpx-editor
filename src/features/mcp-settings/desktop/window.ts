import { setupThemeListener, setupKeyboardShortcuts } from '../../../shared/window-utils.js';

interface McpSettingsData {
  enabled: boolean;
  port: number;
  activePort: number;
  running: boolean;
  connectCommand?: string;
}

const enabledInput = document.getElementById('mcp-enabled') as HTMLInputElement;
const portInput = document.getElementById('mcp-port') as HTMLInputElement;
const statusText = document.getElementById('mcp-status-text') as HTMLElement;
const claudeCmdInput = document.getElementById('mcp-claude-cmd') as HTMLInputElement;
const copyCmdBtn = document.getElementById('mcp-copy-cmd') as HTMLButtonElement;
const copyFeedback = document.getElementById('mcp-copy-feedback') as HTMLElement;
const regenerateBtn = document.getElementById('mcp-regenerate') as HTMLButtonElement;
const okBtn = document.getElementById('mcp-ok') as HTMLButtonElement;
const cancelBtn = document.getElementById('mcp-cancel') as HTMLButtonElement;

let original: McpSettingsData | null = null;

function readPort(): number {
  const parsed = parseInt(portInput.value, 10);
  if (Number.isNaN(parsed)) return 51234;
  return Math.min(65535, Math.max(1024, parsed));
}

function setStatus(): void {
  statusText.classList.remove('mcp-status-ok', 'mcp-status-warn', 'mcp-status-err');
  const liveRunning = original?.running ?? false;
  const liveEnabled = original?.enabled ?? false;
  const pendingEnabled = enabledInput.checked;
  const livePort = original?.port ?? readPort();
  const pendingPort = readPort();

  if (liveRunning) {
    const activePort = original?.activePort ?? livePort;
    statusText.textContent = `running on http://127.0.0.1:${activePort}/mcp`;
    if (activePort !== livePort) statusText.textContent += ` (port ${livePort} was busy)`;
    statusText.classList.add('mcp-status-ok');
  } else if (liveEnabled) {
    statusText.textContent = 'enabled but not running — check the editor console for startup errors';
    statusText.classList.add('mcp-status-warn');
  } else {
    statusText.textContent = 'disabled';
    statusText.classList.add('mcp-status-err');
  }

  const willChange = pendingEnabled !== liveEnabled || (pendingEnabled && pendingPort !== livePort);
  if (willChange) {
    const verb = !liveEnabled && pendingEnabled ? 'started' : liveEnabled && !pendingEnabled ? 'stopped' : 'restarted';
    statusText.textContent += `  (server will be ${verb} when you click OK)`;
  }
}

function updateClaudeCmd(): void {
  if (original?.connectCommand && readPort() === original.port) {
    claudeCmdInput.value = original.connectCommand;
  } else {
    const suffix = original?.connectCommand ? original.connectCommand.replace(/^.*\/mcp/, '') : '';
    claudeCmdInput.value = `claude mcp add --transport http vpx http://127.0.0.1:${readPort()}/mcp${suffix}`;
  }
}

function applyData(data: unknown): void {
  const d = data as McpSettingsData;
  original = d;
  enabledInput.checked = d.enabled;
  portInput.value = String(d.port);
  setStatus();
  updateClaudeCmd();
}

window.vpxEditor.onInitMcpSettings?.(applyData);

regenerateBtn.onclick = async (): Promise<void> => {
  regenerateBtn.disabled = true;
  try {
    const data = await window.vpxEditor.regenerateMcpToken?.();
    if (data) applyData(data);
    copyFeedback.textContent = 'New token generated — reconnect clients with the updated command.';
  } finally {
    regenerateBtn.disabled = false;
  }
};

setupThemeListener();

enabledInput.onchange = (): void => setStatus();
portInput.oninput = (): void => {
  setStatus();
  updateClaudeCmd();
};

copyCmdBtn.onclick = (): void => {
  try {
    navigator.clipboard.writeText(claudeCmdInput.value);
    copyFeedback.textContent = 'Copied to clipboard.';
    setTimeout(() => {
      copyFeedback.textContent = '';
    }, 2000);
  } catch {
    claudeCmdInput.select();
    document.execCommand('copy');
    copyFeedback.textContent = 'Copied (fallback).';
    setTimeout(() => {
      copyFeedback.textContent = '';
    }, 2000);
  }
};

okBtn.onclick = async (): Promise<void> => {
  await window.vpxEditor.saveMcpSettings?.({
    enabled: enabledInput.checked,
    port: readPort(),
  });
  window.close();
};

cancelBtn.onclick = (): void => window.close();

setupKeyboardShortcuts({
  onEscape: (): void => window.close(),
});
