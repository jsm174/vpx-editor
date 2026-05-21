import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Tool, ToolContext } from './types.js';

export class ToolRegistry {
  private readonly tools: Tool[] = [];

  add(tool: Tool): void {
    if (this.tools.some(t => t.name === tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.push(tool);
  }

  addAll(tools: Tool[]): void {
    for (const tool of tools) this.add(tool);
  }

  list(): Tool[] {
    return [...this.tools];
  }

  bind(server: McpServer, ctx: ToolContext, log: (msg: string) => void = () => {}): void {
    for (const tool of this.tools) {
      const shape = (tool.inputSchema as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape;
      const outputShape = tool.outputSchema
        ? (tool.outputSchema as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape
        : undefined;
      server.registerTool(
        tool.name,
        {
          title: tool.title ?? tool.name,
          description: tool.description,
          inputSchema: shape ?? undefined,
          ...(outputShape ? { outputSchema: outputShape } : {}),
          ...(tool.annotations ? { annotations: tool.annotations } : {}),
        },
        async (rawInput: unknown) => {
          const started = Date.now();
          const argSummary = summarizeArgs(rawInput);
          log(`${tool.name}(${argSummary})`);
          try {
            const parsed = tool.inputSchema.parse(rawInput ?? {});
            const result = await tool.execute(parsed, ctx);
            const ms = Date.now() - started;
            if (result.isError) {
              const firstText = result.content.find(c => c.type === 'text') as { text: string } | undefined;
              const errSnippet = firstText ? truncate(firstText.text.replace(/\s+/g, ' ').trim(), 120) : '(no message)';
              log(`${tool.name} → error in ${ms}ms: ${errSnippet}`);
            } else if (ms > 250) {
              log(`${tool.name} → ok in ${ms}ms`);
            }
            return {
              content: result.content as
                { type: 'text'; text: string }[] | { type: 'image'; data: string; mimeType: string }[],
              isError: result.isError,
              structuredContent: result.structuredContent,
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log(`${tool.name} → exception in ${Date.now() - started}ms: ${truncate(message, 120)}`);
            return { content: [{ type: 'text' as const, text: `Tool error: ${message}` }], isError: true };
          }
        }
      );
    }
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '…';
}

function summarizeArgs(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'object') return truncate(String(input), 80);
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return '';
  const parts: string[] = [];
  for (const key of keys) {
    const value = obj[key];
    let rendered: string;
    if (value === null) rendered = 'null';
    else if (value === undefined) continue;
    else if (typeof value === 'string') rendered = JSON.stringify(truncate(value, 40));
    else if (typeof value === 'number' || typeof value === 'boolean') rendered = String(value);
    else if (Array.isArray(value)) rendered = `[${value.length}]`;
    else if (typeof value === 'object') {
      const sub = value as Record<string, unknown>;
      const subKeys = Object.keys(sub);
      if (subKeys.length === 0) rendered = '{}';
      else if (subKeys.length <= 3) {
        rendered =
          '{' +
          subKeys
            .map(k => {
              const v = sub[k];
              if (typeof v === 'string') return `${k}:${JSON.stringify(truncate(v, 20))}`;
              if (typeof v === 'number' || typeof v === 'boolean') return `${k}:${v}`;
              return `${k}:…`;
            })
            .join(',') +
          '}';
      } else rendered = `{${subKeys.length} keys}`;
    } else rendered = '?';
    parts.push(`${key}=${rendered}`);
  }
  return truncate(parts.join(', '), 140);
}
