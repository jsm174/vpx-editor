import { ipcMain, type BrowserWindow } from 'electron';

export interface RendererBridge {
  request(
    window: BrowserWindow,
    kind: string,
    payload: Record<string, unknown>,
    timeoutMs: number
  ): Promise<Record<string, unknown>>;
  waitForTableReady(extractedDir: string, timeoutMs: number): Promise<boolean>;
}

const pending = new Map<string, { senderId: number; finish: (result: Record<string, unknown>) => void }>();
const readyWaiters = new Map<string, () => void>();
const readyDirs = new Set<string>();

let installed = false;

function install(): void {
  if (installed) return;
  installed = true;
  ipcMain.on('mcp-request-result', (event, result: { requestId: string; [key: string]: unknown }) => {
    const cb = pending.get(result.requestId);
    if (cb && cb.senderId === event.sender.id) {
      pending.delete(result.requestId);
      cb.finish(result);
    }
  });
  ipcMain.on('renderer-table-ready', (_event, extractedDir: string) => {
    readyDirs.add(extractedDir);
    readyWaiters.get(extractedDir)?.();
  });
}

let counter = 0;

export function createRendererBridge(): RendererBridge {
  install();
  return {
    request(window, kind, payload, timeoutMs) {
      const requestId = `mcp-${kind}-${Date.now()}-${++counter}`;
      return new Promise(resolve => {
        const finish = (result: Record<string, unknown>): void => {
          clearTimeout(timer);
          pending.delete(requestId);
          window.removeListener('closed', onClosed);
          resolve(result);
        };
        const onClosed = (): void => finish({ success: false, error: 'Editor window closed' });
        const timer = setTimeout(
          () => finish({ success: false, error: `Renderer did not respond to mcp ${kind} request within timeout` }),
          timeoutMs
        );
        pending.set(requestId, { senderId: window.webContents.id, finish });
        window.once('closed', onClosed);
        try {
          window.webContents.send('mcp-request', { requestId, kind, expiresAt: Date.now() + timeoutMs, ...payload });
        } catch (err) {
          finish({ success: false, error: String(err) });
        }
      });
    },
    waitForTableReady(extractedDir, timeoutMs) {
      if (readyDirs.has(extractedDir)) return Promise.resolve(true);
      return new Promise(resolve => {
        const timer = setTimeout(() => {
          readyWaiters.delete(extractedDir);
          resolve(false);
        }, timeoutMs);
        readyWaiters.set(extractedDir, () => {
          clearTimeout(timer);
          readyWaiters.delete(extractedDir);
          resolve(true);
        });
      });
    },
  };
}
