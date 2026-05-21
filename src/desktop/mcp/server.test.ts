import { describe, it, expect, afterEach } from 'vitest';
import { startMcpServer, type McpServerHandle } from './server.js';
import type { ToolContext } from './types.js';

const stubCtx = (): ToolContext => ({}) as unknown as ToolContext;

const TOKEN = 'test-token';

let handle: McpServerHandle | null = null;

afterEach(async () => {
  await handle?.stop();
  handle = null;
});

async function start(opts: Partial<Parameters<typeof startMcpServer>[0]> = {}): Promise<McpServerHandle> {
  handle = await startMcpServer({ port: 0, token: TOKEN, createCtx: stubCtx, ...opts });
  return handle;
}

function request(port: number, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, init);
}

describe('startMcpServer', () => {
  it('refuses to start with an empty token', async () => {
    await expect(startMcpServer({ port: 0, token: '', createCtx: stubCtx })).rejects.toThrow(/token/);
  });

  it('binds an OS-assigned port when asked for port 0', async () => {
    const h = await start();
    expect(h.port).toBeGreaterThan(0);
  });

  it('requires the bearer token on /health', async () => {
    const h = await start();
    const unauthorized = await request(h.port, '/health');
    expect(unauthorized.status).toBe(401);
    const authorized = await request(h.port, '/health', {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(authorized.status).toBe(200);
    const body = (await authorized.json()) as { ok: boolean; sessions: number };
    expect(body.ok).toBe(true);
    expect(body.sessions).toBe(0);
  });

  it('rejects a wrong token on /mcp', async () => {
    const h = await start();
    const res = await request(h.port, '/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer nope', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('404s paths outside /mcp and /health, including /mcpanything', async () => {
    const h = await start();
    for (const path of ['/mcpanything', '/other', '/mcp/extra']) {
      const res = await request(h.port, path, {
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      expect(res.status, path).toBe(404);
    }
  });

  it('rejects new sessions past the session cap', async () => {
    const h = await start({ maxSessions: 0 });
    const res = await request(h.port, '/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } },
      }),
    });
    expect(res.status).toBe(503);
  });

  it('404s an unknown session id', async () => {
    const h = await start();
    const res = await request(h.port, '/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
        'mcp-session-id': 'does-not-exist',
      },
      body: '{}',
    });
    expect(res.status).toBe(404);
  });
});
