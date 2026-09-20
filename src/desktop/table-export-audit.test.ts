import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { exportTableGlbOptions, exportTableObjOptions } from '../shared/obj-transform.js';
import { OBJ_ORIENTATION_VPX, UNIT_CONVERSION_VPU } from '../shared/constants.js';

let vpin: typeof import('@francisdb/vpin-wasm');
let files: Record<string, Uint8Array>;
let firstItemName: string;

beforeAll(async () => {
  vpin = await import('@francisdb/vpin-wasm');
  await vpin.default({
    module_or_path: fs.readFileSync(path.join(process.cwd(), 'node_modules/@francisdb/vpin-wasm/vpin_bg.wasm')),
  });
  const bytes = fs.readFileSync(path.join(process.cwd(), 'public/templates/glfExampleTable.vpx'));
  files = vpin.extract(new Uint8Array(bytes), null) as Record<string, Uint8Array>;
  const primitiveFile = Object.keys(files).find(f => f.startsWith('/vpx/gameitems/Primitive.'))!;
  const parsed = JSON.parse(new TextDecoder().decode(files[primitiveFile])) as Record<string, { name: string }>;
  firstItemName = Object.values(parsed)[0].name;
});

describe('table export option mapping', () => {
  it('maps the item filter onto the vpin obj options', () => {
    const options = exportTableObjOptions({
      unit: UNIT_CONVERSION_VPU,
      orientation: OBJ_ORIENTATION_VPX,
      itemFilter: 'vpinball',
      skipEditorHiddenItems: true,
      onlyItems: ['Wall1'],
    });
    expect(options.itemFilter).toBe('vpinball');
    expect(options.skipEditorHiddenItems).toBe(true);
    expect(options.onlyItems).toEqual(['Wall1']);
    expect(options.extractTextures).toBe(false);
  });

  it('defaults an unknown item filter to everything and drops empty selections', () => {
    const options = exportTableGlbOptions({ itemFilter: 'bogus' as never, onlyItems: [] });
    expect(options.itemFilter).toBe('everything');
    expect(options.skipEditorHiddenItems).toBe(false);
    expect(options.onlyItems).toBeUndefined();
  });
});

describe('vpin audit and filtered export', () => {
  it('audits an extracted table and returns coded findings', () => {
    const findings = vpin.audit(files, null);
    expect(Array.isArray(findings)).toBe(true);
    for (const finding of findings) {
      expect(['error', 'warning', 'suggestion', 'info']).toContain(finding.severity);
      expect(finding.code).toMatch(/^[a-z0-9-]+$/);
      expect(finding.message.length).toBeGreaterThan(0);
    }
  });

  it('exports the playfield plus only the selected item when onlyItems is set', () => {
    const out = vpin.export_obj(
      files,
      exportTableObjOptions({
        unit: UNIT_CONVERSION_VPU,
        orientation: OBJ_ORIENTATION_VPX,
        itemFilter: 'everything',
        skipEditorHiddenItems: false,
        onlyItems: [firstItemName],
      }),
      null
    );
    const obj = new TextDecoder().decode(out['table.obj']);
    const objects = [...obj.matchAll(/^o (.+)$/gm)].map(m => m[1].trim());
    expect(objects.length).toBe(2);
    expect(objects[1].toLowerCase()).toBe(firstItemName.toLowerCase());
  });

  it('exports fewer objects with the vpinball item filter', () => {
    const count = (filter: 'everything' | 'vpinball'): number => {
      const out = vpin.export_obj(
        files,
        exportTableObjOptions({
          unit: UNIT_CONVERSION_VPU,
          orientation: OBJ_ORIENTATION_VPX,
          itemFilter: filter,
          skipEditorHiddenItems: false,
        }),
        null
      );
      return [...new TextDecoder().decode(out['table.obj']).matchAll(/^o (.+)$/gm)].length;
    };
    expect(count('vpinball')).toBeLessThan(count('everything'));
  });
});
