type CallbackFunction = ((...args: unknown[]) => unknown) | null;
type CallbackValue = CallbackFunction | Record<string, unknown> | unknown;

const callbacks = new Map<string, CallbackValue>();

export function registerCallback(name: string, defaultValue: CallbackValue = null): void {
  callbacks.set(name, defaultValue);
}

export function setCallback(name: string, fn: CallbackValue): void {
  callbacks.set(name, fn);
}

export function invokeCallback(name: string, ...args: unknown[]): unknown {
  const callback = callbacks.get(name);
  if (callback && typeof callback === 'function') {
    return callback(...args);
  }
}

export function getCallback<T = unknown>(name: string): T | null {
  return (callbacks.get(name) as T) ?? null;
}

export function hasCallback(name: string): boolean {
  return callbacks.has(name) && callbacks.get(name) !== null;
}

export function clearCallback(name: string): void {
  callbacks.set(name, null);
}
