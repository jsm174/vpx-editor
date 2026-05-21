import { describe, it, expect } from 'vitest';
import { assembleGlfScript } from './assemble.js';
import { findSubs } from '../../../../shared/vbs-analysis.js';

const deviceConfig = ['With CreateGlfBallDevice("scoop")', '    .BallSwitches = Array("s_scoop")', 'End With'].join(
  '\n'
);
const callbacks = ['Sub ScoopEjectCallback(ball)', '    KickBall ball, 14.8, 70, 0, 0', 'End Sub'].join('\n');

describe('assembleGlfScript', () => {
  it('nests the device config inside an existing ConfigureGlfDevices, callbacks at top level', () => {
    const current = ['Sub ConfigureGlfDevices()', "    ' existing", 'End Sub'].join('\n');
    const out = assembleGlfScript(current, { deviceConfig, callbacks });

    const lines = out.split('\n');
    const withLine = lines.findIndex(l => l.includes('CreateGlfBallDevice'));
    const configureEnd = lines.findIndex((l, i) => l.trim() === 'End Sub' && i > withLine);
    const callbackLine = lines.findIndex(l => l.includes('Sub ScoopEjectCallback'));

    // device config sits before ConfigureGlfDevices' End Sub
    expect(withLine).toBeGreaterThan(-1);
    expect(withLine).toBeLessThan(configureEnd);
    // callback sub sits after ConfigureGlfDevices closes (top level)
    expect(callbackLine).toBeGreaterThan(configureEnd);

    // and the callback parses as a real top-level sub
    expect(findSubs(out).some(s => s.name === 'ScoopEjectCallback')).toBe(true);
  });

  it('creates ConfigureGlfDevices when the table has none', () => {
    const out = assembleGlfScript('Option Explicit', { deviceConfig, callbacks });
    expect(out).toContain('Sub ConfigureGlfDevices()');
    expect(out).toContain('CreateGlfBallDevice("scoop")');
    expect(findSubs(out).some(s => s.name === 'ConfigureGlfDevices')).toBe(true);
  });

  it('uses the ConfigureGlfDevices from an appended scaffold block', () => {
    const scaffoldBlock = ['Sub ConfigureGlfDevices()', 'End Sub'].join('\n');
    const out = assembleGlfScript('', { scaffoldBlock, deviceConfig, callbacks });
    const subs = findSubs(out);
    // exactly one ConfigureGlfDevices, and it contains the device config
    expect(subs.filter(s => s.name === 'ConfigureGlfDevices')).toHaveLength(1);
    const cfg = subs.find(s => s.name === 'ConfigureGlfDevices')!;
    expect(cfg.body).toContain('CreateGlfBallDevice("scoop")');
  });
});
