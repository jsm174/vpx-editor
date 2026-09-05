import { AsyncLocalStorage } from 'node:async_hooks';

const queues = new Map<string, Promise<unknown>>();
const active = new AsyncLocalStorage<ReadonlySet<string>>();

/** Shared across sessions; nested context calls retain the enclosing tool's lock. */
export async function serializeTable<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (active.getStore()?.has(key)) return fn();
  const keys = new Set(active.getStore());
  keys.add(key);
  const run = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(() => active.run(keys, fn));
  queues.set(key, run);
  try {
    return await run;
  } finally {
    if (queues.get(key) === run) queues.delete(key);
  }
}
