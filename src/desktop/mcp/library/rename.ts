function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function renameIdentifier(text: string, from: string, to: string): string {
  return text.replace(new RegExp(`\\b${escapeRegex(from)}\\b`, 'gi'), to);
}

export function renameEventHandlerHeader(header: string, from: string, to: string): string {
  const re = new RegExp(
    `^(\\s*(?:Public\\s+|Private\\s+)?(?:Sub|Function)\\s+)${escapeRegex(from)}(_[A-Za-z0-9_]+)`,
    'i'
  );
  return header.replace(re, (_m, lead: string, suffix: string) => `${lead}${to}${suffix}`);
}

export function eventHandlerName(name: string, from: string, to: string): string {
  return name.replace(
    new RegExp(`^${escapeRegex(from)}(_[A-Za-z0-9_]+)$`, 'i'),
    (_m, suffix: string) => `${to}${suffix}`
  );
}

export interface RenamedSub {
  name: string;
  header: string;
  body: string;
}

export function renameClonedSub(
  sub: { name: string; header: string; body: string },
  from: string,
  to: string
): RenamedSub {
  return {
    name: eventHandlerName(sub.name, from, to),
    header: renameIdentifier(renameEventHandlerHeader(sub.header, from, to), from, to),
    body: renameIdentifier(sub.body, from, to),
  };
}
