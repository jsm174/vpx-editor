import { describe, it, expect } from 'vitest';
import { findSubs, lintCommonPitfalls } from './vbs-analysis.js';

const ONE_LINERS = [
  "Dim DropTargetsHit(2)   ' track 3 targets",
  '',
  'Sub DT1_Hit() : DropTargetsHit(0) = True : CheckDropBank : End Sub',
  'Sub DT2_Hit() : DropTargetsHit(1) = True : CheckDropBank : End Sub',
  'Sub DT3_Hit() : DropTargetsHit(2) = True : CheckDropBank : End Sub',
  '',
  'Sub CheckDropBank()',
  '    Dim i, allDown : allDown = True',
  '    For i = 0 To 2',
  '        If Not DropTargetsHit(i) Then allDown = False',
  '    Next',
  'End Sub',
  '',
  'Sub UnrelatedCode()',
  '    DoStuff',
  'End Sub',
].join('\n');

describe('findSubs one-line handling', () => {
  it('closes one-line subs on their own line', () => {
    const subs = findSubs(ONE_LINERS);
    expect(subs.map(s => s.name)).toEqual(['DT1_Hit', 'DT2_Hit', 'DT3_Hit', 'CheckDropBank', 'UnrelatedCode']);
    const dt1 = subs[0];
    expect(dt1.startLine).toBe(3);
    expect(dt1.endLine).toBe(3);
    expect(dt1.body).toContain('DropTargetsHit(0) = True');
  });

  it('does not let a one-line sub swallow following subs', () => {
    const subs = findSubs(ONE_LINERS);
    const check = subs.find(s => s.name === 'CheckDropBank')!;
    expect(check.startLine).toBe(7);
    expect(check.endLine).toBe(12);
    expect(check.body).not.toContain('DoStuff');
  });

  it('handles one-line functions', () => {
    const script = ['Function Dbl(x) : Dbl = x * 2 : End Function', 'Sub After()', 'End Sub'].join('\n');
    const subs = findSubs(script);
    expect(subs).toHaveLength(2);
    expect(subs[0]).toMatchObject({ kind: 'function', name: 'Dbl', startLine: 1, endLine: 1 });
    expect(subs[0].body).toBe('Dbl = x * 2');
  });

  it('does not false-close on End Sub inside a string literal', () => {
    const script = ['Sub Tricky()', '    msg = "not an End Sub here"', 'End Sub'].join('\n');
    const subs = findSubs(script);
    expect(subs[0]).toMatchObject({ name: 'Tricky', startLine: 1, endLine: 3 });

    const oneLine = 'Sub Tricky2() : msg = "End Sub" : End Sub';
    expect(findSubs(oneLine)[0]).toMatchObject({ name: 'Tricky2', startLine: 1, endLine: 1 });
  });

  it('handles empty one-line subs', () => {
    const subs = findSubs('Sub Nop() : End Sub');
    expect(subs[0]).toMatchObject({ name: 'Nop', endLine: 1, body: '' });
  });

  it('flags one-line event subs declared inside a class', () => {
    const script = ['Class Machine', '    Sub Target1_Hit() : score = score + 1 : End Sub', 'End Class'].join('\n');
    const findings = lintCommonPitfalls(script);
    expect(findings.some(f => f.code === 'event-sub-in-class')).toBe(true);
  });

  it('handles Private/Public modifiers, Exit Sub, and CRLF input', () => {
    const script = [
      'Private Sub Helper()',
      '    If x Then Exit Sub',
      '    y = 1',
      'End Sub',
      'Public Function Twice(n)',
      '    Twice = n * 2',
      'End Function',
    ].join('\r\n');
    const subs = findSubs(script);
    expect(subs.map(s => [s.name, s.kind, s.startLine, s.endLine])).toEqual([
      ['Helper', 'sub', 1, 4],
      ['Twice', 'function', 5, 7],
    ]);
    expect(subs[0].body).toContain('Exit Sub');
  });

  it('does not let End Function close a Sub', () => {
    const script = ['Sub Outer()', '    x = 1', 'End Function', '    y = 2', 'End Sub'].join('\n');
    const subs = findSubs(script);
    expect(subs).toHaveLength(1);
    expect(subs[0].endLine).toBe(5);
  });
});
