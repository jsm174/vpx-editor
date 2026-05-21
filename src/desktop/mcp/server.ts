import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Tool, ToolContext } from './types.js';
import { ToolRegistry } from './registry.js';
import { buildGuideTools } from './tools/guide.js';
import { buildTableTools } from './tools/table.js';
import { buildPartTools } from './tools/part.js';
import { buildScriptTools } from './tools/script.js';
import { buildMaterialTools } from './tools/material.js';
import { buildImageTools } from './tools/image.js';
import { buildSoundTools } from './tools/sound.js';
import { buildReferenceTools } from './tools/reference.js';
import { buildHistoryTools } from './tools/history.js';
import { buildLibraryTools } from './tools/library.js';
import { buildNewTableTools } from './tools/new-table.js';
import { buildMpfTools } from './tools/mpf.js';
import { buildGlfBuildTools } from './tools/glf-build.js';
import { buildViewTools } from './tools/view.js';
import { buildGeometryTools } from './tools/geometry.js';
import { buildMeshTools } from './tools/mesh.js';
import { buildTestTools } from './tools/test.js';
import { buildSaveTools } from './tools/save.js';

const SERVER_NAME = 'vpx-editor';
const SERVER_VERSION = '0.1.0';

export interface McpServerHandle {
  port: number;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}

export interface StartOptions {
  port: number;
  token: string;
  /** Per-session ToolContext factory — each session gets its own window binding. */
  createCtx: () => ToolContext;
  onLog?: (msg: string) => void;
  maxSessions?: number;
  sessionIdleMs?: number;
}

const DEFAULT_MAX_SESSIONS = 16;
const DEFAULT_SESSION_IDLE_MS = 30 * 60 * 1000;

export function buildAllTools(): Tool[] {
  return [
    ...buildGuideTools(),
    ...buildNewTableTools(),
    ...buildTableTools(),
    ...buildPartTools(),
    ...buildScriptTools(),
    ...buildMaterialTools(),
    ...buildImageTools(),
    ...buildSoundTools(),
    ...buildReferenceTools(),
    ...buildHistoryTools(),
    ...buildLibraryTools(),
    ...buildGlfBuildTools(),
    ...buildMpfTools(),
    ...buildViewTools(),
    ...buildGeometryTools(),
    ...buildMeshTools(),
    ...buildTestTools(),
    ...buildSaveTools(),
  ];
}

export async function startMcpServer(opts: StartOptions): Promise<McpServerHandle> {
  const { port, token, createCtx } = opts;
  const log = opts.onLog ?? (() => {});
  if (!token) {
    throw new Error('MCP server refused to start: bearer token is empty');
  }
  const maxSessions = opts.maxSessions ?? DEFAULT_MAX_SESSIONS;
  const sessionIdleMs = opts.sessionIdleMs ?? DEFAULT_SESSION_IDLE_MS;

  const registry = new ToolRegistry();
  registry.addAll(buildAllTools());

  interface Session {
    server: McpServer;
    transport: StreamableHTTPServerTransport;
    lastActivity: number;
  }
  const sessions = new Map<string, Session>();

  function newMcpServer(): McpServer {
    const s = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    const ctx = createCtx();
    registry.bind(s, ctx, ctx.log);
    return s;
  }

  async function createSession(): Promise<Session> {
    const server = newMcpServer();
    const session: Session = {
      server,
      transport: null as unknown as StreamableHTTPServerTransport,
      lastActivity: Date.now(),
    };
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableDnsRebindingProtection: true,
      allowedHosts: ['127.0.0.1', `127.0.0.1:${actualPort()}`, 'localhost', `localhost:${actualPort()}`],
      onsessioninitialized: (id: string) => {
        sessions.set(id, session);
        log(`MCP session opened: ${id}`);
      },
    });
    session.transport = transport;
    transport.onclose = () => {
      const id = transport.sessionId;
      if (id && sessions.get(id)?.transport === transport) {
        sessions.delete(id);
        log(`MCP session closed: ${id}`);
      }
      void server.close().catch(() => {});
    };
    await server.connect(transport);
    return session;
  }

  async function closeSession(id: string, session: Session): Promise<void> {
    sessions.delete(id);
    try {
      await session.transport.close();
    } catch {
      /* ignore */
    }
    try {
      await session.server.close();
    } catch {
      /* ignore */
    }
  }

  const idleSweep = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > sessionIdleMs) {
        log(`MCP session expired (idle): ${id}`);
        void closeSession(id, session);
      }
    }
  }, 60_000);
  idleSweep.unref?.();

  function isAuthorized(req: http.IncomingMessage): boolean {
    const auth = req.headers['authorization'];
    const authStr = Array.isArray(auth) ? auth[0] : auth;
    return authStr === `Bearer ${token}`;
  }

  const httpServer = http.createServer(async (req, res) => {
    const pathname = (req.url ?? '').split('?')[0];
    if (pathname !== '/mcp' && pathname !== '/health') {
      res.writeHead(404).end();
      return;
    }
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (req.method === 'GET' && pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          name: SERVER_NAME,
          version: SERVER_VERSION,
          tools: registry.list().length,
          sessions: sessions.size,
        })
      );
      return;
    }
    if (pathname !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    try {
      let body: unknown = undefined;
      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        if (chunks.length > 0) {
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          } catch {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid JSON' }));
            return;
          }
        }
      }
      const sessionId = req.headers['mcp-session-id'];
      const sessionIdStr = Array.isArray(sessionId) ? sessionId[0] : sessionId;
      let session: Session;
      if (sessionIdStr) {
        const existing = sessions.get(sessionIdStr);
        if (!existing) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32001, message: 'Session not found — reinitialize' },
              id: null,
            })
          );
          return;
        }
        session = existing;
      } else {
        if (sessions.size >= maxSessions) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: `Session limit reached (${maxSessions}) — close idle clients` },
              id: null,
            })
          );
          return;
        }
        session = await createSession();
      }
      session.lastActivity = Date.now();
      await session.transport.handleRequest(req, res, body);
      if (!sessionIdStr && !session.transport.sessionId) {
        void session.transport.close().catch(() => {});
      }
    } catch (err) {
      log(`MCP request error: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '127.0.0.1', () => {
      httpServer.removeListener('error', reject);
      resolve();
    });
  });

  function actualPort(): number {
    const addr = httpServer.address();
    return addr && typeof addr === 'object' ? addr.port : port;
  }

  log(`MCP server listening on http://127.0.0.1:${actualPort()}/mcp (${registry.list().length} tools)`);

  let running = true;
  return {
    port: actualPort(),
    isRunning: () => running,
    stop: async () => {
      running = false;
      clearInterval(idleSweep);
      for (const [id, s] of sessions) {
        await closeSession(id, s);
      }
      sessions.clear();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
      log('MCP server stopped');
    },
  };
}
