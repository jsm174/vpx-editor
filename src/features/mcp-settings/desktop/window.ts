import { setupThemeListener, setupKeyboardShortcuts } from '../../../shared/window-utils.js';

interface McpSettingsData {
  enabled: boolean;
  port: number;
  activePort: number;
  running: boolean;
  token: string;
  lastAuthFailure: { at: number; reason: 'missing' | 'mismatch' } | null;
}

type ClientId = 'claude-code' | 'codex';

interface ClientSetup {
  steps: string;
  snippet: string;
  snippetLabel: string;
}

const enabledInput = document.getElementById('mcp-enabled') as HTMLInputElement;
const portInput = document.getElementById('mcp-port') as HTMLInputElement;
const statusText = document.getElementById('mcp-status-text') as HTMLElement;
const authFailureBox = document.getElementById('mcp-auth-failure') as HTMLElement;
const endpointInput = document.getElementById('mcp-endpoint') as HTMLInputElement;
const tokenInput = document.getElementById('mcp-token') as HTMLInputElement;
const copyEndpointBtn = document.getElementById('mcp-copy-endpoint') as HTMLButtonElement;
const copyTokenBtn = document.getElementById('mcp-copy-token') as HTMLButtonElement;
const regenerateBtn = document.getElementById('mcp-regenerate') as HTMLButtonElement;
const clientSelect = document.getElementById('mcp-client') as HTMLSelectElement;
const clientSteps = document.getElementById('mcp-client-steps') as HTMLElement;
const snippetArea = document.getElementById('mcp-snippet') as HTMLTextAreaElement;
const snippetLabel = document.getElementById('mcp-snippet-label') as HTMLElement;
const copySnippetBtn = document.getElementById('mcp-copy-snippet') as HTMLButtonElement;
const copyFeedback = document.getElementById('mcp-copy-feedback') as HTMLElement;
const okBtn = document.getElementById('mcp-ok') as HTMLButtonElement;
const cancelBtn = document.getElementById('mcp-cancel') as HTMLButtonElement;

const isWindows = navigator.platform.startsWith('Win');
const CLIENT_STORAGE_KEY = 'mcp-settings-client';

let original: McpSettingsData | null = null;
let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

function readPort(): number {
  const parsed = parseInt(portInput.value, 10);
  if (Number.isNaN(parsed)) return 51234;
  return Math.min(65535, Math.max(1024, parsed));
}

function endpoint(): string {
  const pending = readPort();
  const port = original && pending === original.port ? original.activePort : pending;
  return `http://127.0.0.1:${port}/mcp`;
}

function token(): string {
  return original?.token ?? '';
}

function formatAge(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
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

  const failure = original?.lastAuthFailure ?? null;
  if (failure && liveRunning) {
    authFailureBox.hidden = false;
    authFailureBox.textContent =
      failure.reason === 'missing'
        ? `A client tried to connect ${formatAge(failure.at)} without an access token. Pick it below and follow the steps so it sends the token.`
        : `A client tried to connect ${formatAge(failure.at)} with an old or wrong access token. Set it up again with the current token below.`;
  } else {
    authFailureBox.hidden = true;
    authFailureBox.textContent = '';
  }
}

function codexConfigPath(): string {
  return isWindows ? '%USERPROFILE%\\.codex\\config.toml' : '~/.codex/config.toml';
}

function buildSetup(client: ClientId): ClientSetup {
  const url = endpoint();
  const bearer = `Bearer ${token()}`;
  switch (client) {
    case 'claude-code':
      return {
        steps:
          '<ol><li>Run this in a terminal.</li><li>Start Claude Code, or restart it if it is already open.</li><li>Ask it to run <code>vpx_guide</code> to confirm the connection.</li></ol>',
        snippet: `claude mcp add --transport http vpx ${url} --header "Authorization: ${bearer}"`,
        snippetLabel: 'Terminal command',
      };
    case 'codex':
      return {
        steps:
          `<ol><li>Open <code>${codexConfigPath()}</code> in a text editor. Create it if it does not exist.</li>` +
          `<li>Paste this block at the end of the file.</li>` +
          `<li>Restart Codex. In the CLI, <code>codex mcp list</code> should show <code>vpx</code>.</li></ol>`,
        snippet: `[mcp_servers.vpx]\nurl = "${url}"\nhttp_headers = { Authorization = "${bearer}" }`,
        snippetLabel: 'config.toml',
      };
  }
}

function renderClient(): void {
  const client = clientSelect.value as ClientId;
  const setup = buildSetup(client);
  clientSteps.innerHTML = setup.steps;
  snippetArea.value = setup.snippet;
  snippetArea.rows = Math.min(14, Math.max(4, setup.snippet.split('\n').length + 1));
  snippetLabel.textContent = setup.snippetLabel;
  rememberClient(client);
}

function rememberClient(client: string): void {
  try {
    localStorage.setItem(CLIENT_STORAGE_KEY, client);
  } catch {
    return;
  }
}

function recallClient(): string | null {
  try {
    return localStorage.getItem(CLIENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function refreshConnection(): void {
  endpointInput.value = endpoint();
  tokenInput.value = token();
  renderClient();
}

function applyData(data: unknown): void {
  const d = data as McpSettingsData;
  original = d;
  enabledInput.checked = d.enabled;
  portInput.value = String(d.port);
  setStatus();
  refreshConnection();
}

function showFeedback(message: string, sticky = false): void {
  copyFeedback.textContent = message;
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = null;
  if (!sticky) {
    feedbackTimer = setTimeout(() => {
      copyFeedback.textContent = '';
    }, 2500);
  }
}

function copyText(text: string, what: string): void {
  navigator.clipboard
    .writeText(text)
    .then(() => showFeedback(`${what} copied to clipboard.`))
    .catch(() => showFeedback(`Could not copy ${what.toLowerCase()}. Select it and copy manually.`));
}

const savedClient = recallClient();
if (savedClient && Array.from(clientSelect.options).some(o => o.value === savedClient))
  clientSelect.value = savedClient;

window.vpxEditor.onInitMcpSettings?.(applyData);
setInterval(setStatus, 5000);

regenerateBtn.onclick = async (): Promise<void> => {
  regenerateBtn.disabled = true;
  try {
    const data = await window.vpxEditor.regenerateMcpToken?.();
    if (data) applyData(data);
    showFeedback(
      'New token generated. Every client must be set up again with the new token before it can connect.',
      true
    );
  } finally {
    regenerateBtn.disabled = false;
  }
};

copyEndpointBtn.onclick = (): void => copyText(endpoint(), 'Endpoint');
copyTokenBtn.onclick = (): void => copyText(token(), 'Access token');
copySnippetBtn.onclick = (): void =>
  copyText(snippetArea.value, buildSetup(clientSelect.value as ClientId).snippetLabel);

clientSelect.onchange = (): void => renderClient();

setupThemeListener();

enabledInput.onchange = (): void => setStatus();
portInput.oninput = (): void => {
  setStatus();
  refreshConnection();
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
