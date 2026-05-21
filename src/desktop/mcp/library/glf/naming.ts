// GLF wires game logic to physical parts by name: switches are referenced as
// `s_*`, coils as `c_*`, lights as `l_*`. The generator must give a placed part
// the exact name the emitted GLF config references — this module is that bridge.

export const GLF_PREFIX = {
  switch: 's_',
  coil: 'c_',
  light: 'l_',
} as const;

export type GlfKind = keyof typeof GLF_PREFIX;

/** Lowercase, collapse non-alphanumeric runs to single underscores, trim edges. */
export function normalizeBase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** GLF-prefixed name for a base, e.g. glfName('switch', 'Scoop') -> 's_scoop'. Idempotent. */
export function glfName(kind: GlfKind, base: string): string {
  const prefix = GLF_PREFIX[kind];
  const norm = normalizeBase(base);
  return norm.startsWith(prefix) ? norm : `${prefix}${norm}`;
}

export const switchName = (base: string): string => glfName('switch', base);

export interface NameBinding {
  kind: GlfKind;
  base: string;
  name: string;
}

// Allocates GLF names that are unique against the names already present in the
// target table, and records each binding so the physical placement and the GLF
// config can be cross-checked (every emitted .Switch must resolve to a placed part).
export class NameRegistry {
  private readonly used: Set<string>;
  private readonly bindings: NameBinding[] = [];

  constructor(existingNames: Iterable<string> = []) {
    this.used = new Set([...existingNames].map(n => n.toLowerCase()));
  }

  allocate(kind: GlfKind, base: string): string {
    const wanted = glfName(kind, base);
    let candidate = wanted;
    let suffix = 1;
    while (this.used.has(candidate.toLowerCase())) {
      candidate = `${wanted}${suffix}`;
      suffix += 1;
    }
    this.used.add(candidate.toLowerCase());
    this.bindings.push({ kind, base, name: candidate });
    return candidate;
  }

  has(name: string): boolean {
    return this.used.has(name.toLowerCase());
  }

  list(): NameBinding[] {
    return [...this.bindings];
  }
}
