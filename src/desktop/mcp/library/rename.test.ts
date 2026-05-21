import { describe, it, expect } from 'vitest';
import { renameClonedSub, renameIdentifier, renameEventHandlerHeader, eventHandlerName } from './rename.js';

describe('renameIdentifier', () => {
  it('replaces whole identifiers only', () => {
    expect(renameIdentifier('Gates.Visible = 1 : Gate.Open = True', 'Gate', 'Cloned_Gate')).toBe(
      'Gates.Visible = 1 : Cloned_Gate.Open = True'
    );
  });

  it('is case-insensitive like VBScript', () => {
    expect(renameIdentifier('gate.Open = True', 'Gate', 'Cloned_Gate')).toBe('Cloned_Gate.Open = True');
  });

  it('does not touch the donor name inside longer identifiers', () => {
    expect(renameIdentifier('LeftGate_Hit', 'Gate', 'X')).toBe('LeftGate_Hit');
  });
});

describe('renameEventHandlerHeader', () => {
  it('renames the event-handler prefix and keeps the suffix and params', () => {
    expect(renameEventHandlerHeader('Sub Gate_Hit()', 'Gate', 'Cloned_Gate')).toBe('Sub Cloned_Gate_Hit()');
    expect(renameEventHandlerHeader('Sub Kicker1_Timer', 'Kicker1', 'Scoop')).toBe('Sub Scoop_Timer');
    expect(renameEventHandlerHeader('Sub Flip_Collide(parm)', 'Flip', 'LeftFlipper')).toBe(
      'Sub LeftFlipper_Collide(parm)'
    );
    expect(renameEventHandlerHeader('Public Function Sling_Slingshot()', 'Sling', 'LSling')).toBe(
      'Public Function LSling_Slingshot()'
    );
  });

  it('leaves helpers that merely mention the part alone', () => {
    expect(renameEventHandlerHeader('Sub UpdateGates()', 'Gate', 'Cloned_Gate')).toBe('Sub UpdateGates()');
  });
});

describe('eventHandlerName', () => {
  it('mirrors the header rename', () => {
    expect(eventHandlerName('Gate_UnHit', 'Gate', 'Cloned_Gate')).toBe('Cloned_Gate_UnHit');
    expect(eventHandlerName('Gates_Hit', 'Gate', 'Cloned_Gate')).toBe('Gates_Hit');
  });
});

describe('renameClonedSub', () => {
  it('renames header, name and body together', () => {
    const out = renameClonedSub(
      { name: 'Gate_Hit', header: 'Sub Gate_Hit()', body: '    Gate.Open = True\n    Gates_Hit 1' },
      'Gate',
      'Cloned_Gate'
    );
    expect(out.name).toBe('Cloned_Gate_Hit');
    expect(out.header).toBe('Sub Cloned_Gate_Hit()');
    expect(out.body).toBe('    Cloned_Gate.Open = True\n    Gates_Hit 1');
  });

  it('renames references inside a one-line handler header', () => {
    const out = renameClonedSub(
      { name: 'Gate_Hit', header: 'Sub Gate_Hit : Gate.Open = True : End Sub', body: 'Gate.Open = True' },
      'Gate',
      'Cloned_Gate'
    );
    expect(out.header).toBe('Sub Cloned_Gate_Hit : Cloned_Gate.Open = True : End Sub');
  });
});
