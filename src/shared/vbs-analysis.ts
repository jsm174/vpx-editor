export interface VbsSub {
  kind: 'sub' | 'function';
  name: string;
  startLine: number;
  endLine: number;
  /** The body lines between the Sub/End Sub markers (does NOT include the header or End Sub). */
  body: string;
  /** The verbatim opening line, e.g. "Sub Foo(arg)" or "Public Function Bar(x, y)". */
  header: string;
}

const LINE_COMMENT = /^\s*'/;

export function stripComments(line: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inString = !inString;
    if (c === "'" && !inString) break;
    out += c;
  }
  return out;
}

export function splitLines(script: string): string[] {
  return script.split(/\r\n|\r|\n/);
}

export function stripAllComments(script: string): string {
  return splitLines(script).map(stripComments).join('\n');
}

function closesOnSameLine(line: string, keyword: string): boolean {
  const noStrings = stripComments(line).replace(/"[^"]*"/g, '""');
  return new RegExp(`\\bEnd\\s+${keyword}\\b`, 'i').test(noStrings);
}

function oneLineBody(line: string, keyword: string): string {
  const noComment = stripComments(line);
  const first = noComment.indexOf(':');
  if (first === -1) return '';
  const withoutHeader = noComment.slice(first + 1);
  const closer = new RegExp(`:?\\s*End\\s+${keyword}\\b.*$`, 'i');
  return withoutHeader.replace(closer, '').trim();
}

export function findSubs(script: string): VbsSub[] {
  const lines = splitLines(script);
  const subs: VbsSub[] = [];
  const openRe = /^\s*(?:Public\s+|Private\s+)?(Sub|Function)\s+([A-Za-z_][A-Za-z0-9_]*)/i;
  const closeRe = /^\s*End\s+(Sub|Function)\b/i;
  let current: {
    kind: 'sub' | 'function';
    name: string;
    startLine: number;
    header: string;
    bodyLines: string[];
  } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (LINE_COMMENT.test(raw) && !current) continue;
    if (!current) {
      const m = openRe.exec(raw);
      if (m) {
        const kind = m[1].toLowerCase() === 'sub' ? 'sub' : 'function';
        if (closesOnSameLine(raw, m[1])) {
          subs.push({
            kind,
            name: m[2],
            startLine: i + 1,
            endLine: i + 1,
            body: oneLineBody(raw, m[1]),
            header: raw,
          });
        } else {
          current = {
            kind,
            name: m[2],
            startLine: i + 1,
            header: raw,
            bodyLines: [],
          };
        }
      }
    } else {
      const close = closeRe.exec(raw);
      if (close && close[1].toLowerCase() === current.kind) {
        subs.push({
          kind: current.kind,
          name: current.name,
          startLine: current.startLine,
          endLine: i + 1,
          body: current.bodyLines.join('\n'),
          header: current.header,
        });
        current = null;
      } else {
        current.bodyLines.push(raw);
      }
    }
  }
  return subs;
}

export function findSubsReferencingIdentifier(script: string, identifier: string): VbsSub[] {
  const subs = findSubs(script);
  const ident = identifier.toLowerCase();
  return subs.filter(s => s.body.toLowerCase().includes(ident));
}

export interface VbsClass {
  name: string;
  startLine: number;
  endLine: number;
  body: string;
}

export function findClasses(script: string): VbsClass[] {
  const lines = splitLines(script);
  const out: VbsClass[] = [];
  const openRe = /^\s*Class\s+([A-Za-z_][A-Za-z0-9_]*)/i;
  const closeRe = /^\s*End\s+Class\b/i;
  let current: { name: string; startLine: number; bodyLines: string[] } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (LINE_COMMENT.test(raw) && !current) continue;
    if (!current) {
      const m = openRe.exec(raw);
      if (m) current = { name: m[1], startLine: i + 1, bodyLines: [] };
    } else {
      if (closeRe.test(raw)) {
        out.push({
          name: current.name,
          startLine: current.startLine,
          endLine: i + 1,
          body: current.bodyLines.join('\n'),
        });
        current = null;
      } else {
        current.bodyLines.push(raw);
      }
    }
  }
  return out;
}

export function findClassReferencesInText(text: string, knownClassNames: string[]): string[] {
  if (knownClassNames.length === 0) return [];
  const stripped = splitLines(text).map(stripComments).join('\n');
  const out = new Set<string>();
  for (const cls of knownClassNames) {
    const ident = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match `New ClassName`, `As ClassName`, or bare reference after `Set x = New ClassName`
    const re = new RegExp(`\\b(?:New|As)\\s+${ident}\\b`, 'i');
    if (re.test(stripped)) out.add(cls);
  }
  return [...out];
}

export function findSubReferencesInText(text: string, knownSubNames: string[]): string[] {
  if (knownSubNames.length === 0) return [];
  const stripped = splitLines(text).map(stripComments).join('\n');
  const out = new Set<string>();
  for (const sub of knownSubNames) {
    const ident = sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match `Call Sub`, bare `Sub(...)` invocation, or `vpmTimer.PulseSw Sub` -style refs
    const re = new RegExp(`\\b${ident}\\b\\s*[(\\s,]`, 'i');
    if (re.test(stripped)) out.add(sub);
  }
  return [...out];
}

export interface VbsConstant {
  name: string;
  value: string;
  line: number;
}

export function findConstants(script: string): VbsConstant[] {
  const lines = splitLines(script);
  const out: VbsConstant[] = [];
  const re = /^\s*(?:Public\s+|Private\s+)?Const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*(?:'.*)?$/i;
  for (let i = 0; i < lines.length; i++) {
    if (LINE_COMMENT.test(lines[i])) continue;
    const m = re.exec(lines[i]);
    if (m) out.push({ name: m[1], value: m[2].replace(/\s+$/, ''), line: i + 1 });
  }
  return out;
}

export interface LintFinding {
  line: number;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

/**
 * Lint a VBS script for common pitfalls.
 *
 * @param script    The full VBS source to analyze.
 * @param coreSymbols  Set of identifiers actually declared (Const/Dim/Class) at the top level of any
 *                     loaded system script (e.g. core.vbs). If empty/undefined, the core-vbs redef
 *                     check is skipped (better than the previous hand-maintained list that
 *                     produced false positives for `tnob` and `BallSize`).
 */
export function lintCommonPitfalls(script: string, coreSymbols: Set<string> = new Set()): LintFinding[] {
  const findings: LintFinding[] = [];
  const lines = splitLines(script);
  const loadsCore = /ExecuteGlobal\s+GetTextFile\s*\(\s*["']core\.vbs["']/i.test(script);

  // 1. core.vbs symbol redefinitions — only checked if we have a real symbol list
  if (loadsCore && coreSymbols.size > 0) {
    const redefRe = /^\s*(?:Const|Dim|Public|Private)\s+(?:Const\s+)?([A-Za-z_][A-Za-z0-9_]*)/i;
    for (let i = 0; i < lines.length; i++) {
      const stripped = stripComments(lines[i]);
      const m = redefRe.exec(stripped);
      if (m && coreSymbols.has(m[1])) {
        findings.push({
          line: i + 1,
          severity: 'error',
          code: 'core-vbs-redef',
          message: `'${m[1]}' is declared in a loaded system script. Redefining it will cause VBSE_NAME_REDEFINED at runtime. Remove the local declaration or rename it.`,
        });
      }
    }
  }

  // 2. Sub declared inside a Class body (won't fire as a Foo_Hit / Foo_Timer handler)
  const classRanges: { name: string; startLine: number; endLine: number }[] = findClasses(script).map(c => ({
    name: c.name,
    startLine: c.startLine,
    endLine: c.endLine,
  }));
  for (const sub of findSubs(script)) {
    const enclosing = classRanges.find(r => sub.startLine > r.startLine && sub.endLine < r.endLine);
    if (enclosing && /^[A-Za-z_][A-Za-z0-9_]*_(Hit|Timer|Collide|Init|UnHit|Slingshot|Spin)$/.test(sub.name)) {
      findings.push({
        line: sub.startLine,
        severity: 'warning',
        code: 'event-sub-in-class',
        message: `Sub "${sub.name}" looks like an event handler ({Part}_{Event}) but is declared inside Class "${enclosing.name}". Event handlers only fire when declared at the script top level — vpinball won't invoke this one.`,
      });
    }
  }

  // 3. Self-assignment via `Set foo = New foo` (common typo where the var has the same name as a class)
  const selfAssignRe = /^\s*Set\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*New\s+\1\b/i;
  for (let i = 0; i < lines.length; i++) {
    const stripped = stripComments(lines[i]);
    const m = selfAssignRe.exec(stripped);
    if (m) {
      findings.push({
        line: i + 1,
        severity: 'warning',
        code: 'self-new-assignment',
        message: `Variable "${m[1]}" is assigned a New instance of a class with the same name. This is usually a typo — did you mean a different class name?`,
      });
    }
  }

  // 4. Object assignment missing Set keyword
  // e.g. `x = New Foo` should be `Set x = New Foo`
  const missingSetRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*New\s+[A-Za-z_]/i;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*Set\b/i.test(raw)) continue;
    const stripped = stripComments(raw);
    if (missingSetRe.test(stripped)) {
      findings.push({
        line: i + 1,
        severity: 'error',
        code: 'missing-set-keyword',
        message:
          'Object assignment (= New ...) requires the "Set" keyword: write "Set x = New Foo", not "x = New Foo".',
      });
    }
  }

  return findings;
}

export function grep(
  script: string,
  pattern: string | RegExp,
  contextLines = 2
): { line: number; match: string; before: string[]; after: string[] }[] {
  const lines = splitLines(script);
  const out: { line: number; match: string; before: string[]; after: string[] }[] = [];
  const isString = typeof pattern === 'string';
  // Multi-line behavior: string patterns that contain newlines, or regexes with the `s` flag,
  // get matched against the joined source. Single-line patterns use the original per-line scan
  // (faster, returns one entry per matched line).
  const isMultiline = isString
    ? (pattern as string).includes('\n')
    : ((pattern as RegExp).flags?.includes('s') ?? false) || (pattern as RegExp).source.includes('\\n');

  if (isMultiline) {
    const flags = isString
      ? 'gi'
      : (pattern as RegExp).flags.includes('g')
        ? (pattern as RegExp).flags
        : (pattern as RegExp).flags + 'g';
    const re = isString
      ? new RegExp((pattern as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
      : new RegExp((pattern as RegExp).source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(script)) !== null) {
      const matchStart = m.index;
      const matchEnd = matchStart + m[0].length;
      // Convert character offsets to 1-based line numbers
      const startLineIdx = script.slice(0, matchStart).split(/\r\n|\r|\n/).length - 1;
      const endLineIdx = script.slice(0, matchEnd).split(/\r\n|\r|\n/).length - 1;
      out.push({
        line: startLineIdx + 1,
        match: lines.slice(startLineIdx, endLineIdx + 1).join('\n'),
        before: lines.slice(Math.max(0, startLineIdx - contextLines), startLineIdx),
        after: lines.slice(endLineIdx + 1, Math.min(lines.length, endLineIdx + 1 + contextLines)),
      });
      if (m[0].length === 0) re.lastIndex++;
    }
    return out;
  }

  const re = isString
    ? new RegExp((pattern as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : (pattern as RegExp);
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      out.push({
        line: i + 1,
        match: lines[i],
        before: lines.slice(Math.max(0, i - contextLines), i),
        after: lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines)),
      });
    }
  }
  return out;
}
