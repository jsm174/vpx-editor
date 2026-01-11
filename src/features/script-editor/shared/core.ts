export interface ParsedFunction {
  name: string;
  type: string;
  line: number;
}

export interface ScriptGameItem {
  name: string;
  type: string;
}

export const ITEM_EVENTS: Record<string, string[]> = {
  Primitive: ['Init', 'Timer'],
  Wall: ['Init', 'Hit', 'Timer', 'Slingshot'],
  Surface: ['Init', 'Hit', 'Timer', 'Slingshot'],
  Flipper: ['Init', 'Timer', 'Collide', 'LimitBOS', 'LimitEOS'],
  Bumper: ['Hit', 'Timer', 'UnHit'],
  Trigger: ['Hit', 'Timer', 'Unhit'],
  Light: ['Init', 'Timer'],
  Kicker: ['Hit', 'Timer', 'UnHit'],
  Gate: ['Init', 'Timer', 'Open', 'Close'],
  Spinner: ['Init', 'Timer', 'Spin'],
  Ramp: ['Init', 'Timer'],
  Rubber: ['Init', 'Timer', 'Hit'],
  HitTarget: ['Init', 'Timer', 'Hit', 'Dropped', 'Raised'],
  DropTarget: ['Init', 'Timer', 'Hit', 'Dropped', 'Raised'],
  Plunger: ['Init', 'Timer', 'LimitBOS', 'LimitEOS'],
  TextBox: ['Init', 'Timer'],
  Timer: ['Timer'],
  Decal: ['Init'],
  Flasher: ['Init', 'Timer'],
  LightSequencer: ['Init', 'Timer'],
  Reel: ['Init', 'Timer'],
  Ball: ['Init'],
};

export const VPINBALL_API = [
  'PlaySound',
  'StopSound',
  'PlayMusic',
  'MusicVolume',
  'GetBalls',
  'CreateBall',
  'DestroyBall',
  'ActiveBall',
  'GameTime',
  'SystemTime',
  'GetPlayerHWnd',
  'UserDirectory',
  'TablesDirectory',
  'NudgeGetCalibration',
  'NudgeSetCalibration',
  'Nudge',
  'GetCustomParam',
  'FireKnocker',
  'QuitPlayer',
  'AddObject',
  'Version',
  'VPBuildVersion',
  'VersionMajor',
  'VersionMinor',
  'VersionRevision',
];

export function parseScriptFunctions(code: string): ParsedFunction[] {
  const functions: ParsedFunction[] = [];
  const lines = code.split('\n');
  const regex = /^\s*(sub|function|class|property\s+(get|let|set))\s+(\w+)/i;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(regex);
    if (match) {
      const type = match[1].toLowerCase();
      const name = match[3] || match[2];
      functions.push({ name, type, line: i + 1 });
    }
  }

  return functions.sort((a, b) => a.name.localeCompare(b.name));
}

export function generateEventHandler(itemName: string, eventName: string): string {
  return `\nSub ${itemName}_${eventName}()\n\t\nEnd Sub\n`;
}

export function findEventHandler(code: string, itemName: string, eventName: string): { found: boolean; line: number } {
  const subName = `${itemName}_${eventName}`;
  const regex = new RegExp(`^\\s*sub\\s+${subName}\\s*\\(?`, 'im');
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      return { found: true, line: i + 1 };
    }
  }

  return { found: false, line: -1 };
}

export function getEventsForItemType(itemType: string): string[] {
  return ITEM_EVENTS[itemType] || [];
}
