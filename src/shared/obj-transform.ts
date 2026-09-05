import type { AxisConvention, ExportUnits, MeshIoOptions, ObjExportOptions } from '@francisdb/vpin-wasm';
import { OBJ_ORIENTATION_VPX, OBJ_ORIENTATION_Y_UP_RH, UNIT_CONVERSION_VPU } from './constants.js';
import { vpUnitsToUnit } from './unit-conversion.js';

const AXIS_Z_DOWN_RIGHT_HANDED = 1 as AxisConvention;
const AXIS_Y_UP_RIGHT_HANDED = 2 as AxisConvention;
const EXPORT_UNITS_VPU = 0 as ExportUnits;
const EXPORT_UNITS_M = 3 as ExportUnits;

export type ObjOrientation = typeof OBJ_ORIENTATION_VPX | typeof OBJ_ORIENTATION_Y_UP_RH;

export interface ObjExchangeOptions {
  unit: string;
  orientation: ObjOrientation;
}

const OBJ_HEADER_PREFIX = '# vpx-editor';

export function objUnitScale(unit: string): number {
  return vpUnitsToUnit(1, unit);
}

export function isIdentityExchange(options: ObjExchangeOptions): boolean {
  return options.orientation === OBJ_ORIENTATION_VPX && objUnitScale(options.unit) === 1;
}

function orientationAxes(orientation: ObjOrientation): AxisConvention {
  return orientation === OBJ_ORIENTATION_Y_UP_RH ? AXIS_Y_UP_RIGHT_HANDED : AXIS_Z_DOWN_RIGHT_HANDED;
}

export function exportMeshIoOptions(options: ObjExchangeOptions): MeshIoOptions {
  return {
    axes: orientationAxes(options.orientation),
    unitScale: objUnitScale(options.unit),
  };
}

export type TableExportVisibility = 'render' | 'editor';

export interface TableObjExportOptions extends ObjExportOptions {
  visibility?: TableExportVisibility;
}

export function exportTableObjOptions(options: ObjExchangeOptions): TableObjExportOptions {
  return {
    axes: orientationAxes(options.orientation),
    units: options.unit === UNIT_CONVERSION_VPU ? EXPORT_UNITS_VPU : EXPORT_UNITS_M,
    extractTextures: false,
    visibility: 'editor',
  };
}

export function renameObjMtlReference(objText: string, mtlFileName: string): string {
  return objText.replace(/^mtllib .*$/m, `mtllib ${mtlFileName}`);
}

export function importMeshIoOptions(options: ObjExchangeOptions): MeshIoOptions {
  return {
    axes: orientationAxes(options.orientation),
    unitScale: 1 / objUnitScale(options.unit),
  };
}

function buildObjHeaderComment(options: ObjExchangeOptions): string {
  return `${OBJ_HEADER_PREFIX} units=${options.unit} orientation=${options.orientation} vpu-scale=${objUnitScale(
    options.unit
  ).toFixed(8)}`;
}

export function parseObjHeaderComment(text: string): ObjExchangeOptions | null {
  for (const line of text.split('\n', 8)) {
    if (!line.startsWith(OBJ_HEADER_PREFIX)) continue;
    const unit = /\bunits=([\w-]+)/.exec(line)?.[1];
    const orientation = /\borientation=([\w-]+)/.exec(line)?.[1];
    if (!unit || !orientation) continue;
    if (orientation !== OBJ_ORIENTATION_VPX && orientation !== OBJ_ORIENTATION_Y_UP_RH) {
      continue;
    }
    return { unit, orientation };
  }
  return null;
}

export function insertObjHeaderComment(obj: string, options: ObjExchangeOptions): string {
  if (parseObjHeaderComment(obj)) return obj;
  const header = buildObjHeaderComment(options);
  const firstNewline = obj.indexOf('\n');
  if (firstNewline < 0) return `${header}\n${obj}`;
  return obj.slice(0, firstNewline + 1) + header + '\n' + obj.slice(firstNewline + 1);
}

export function defaultExchange(unit: string, orientation: string | undefined): ObjExchangeOptions {
  const o = orientation === OBJ_ORIENTATION_Y_UP_RH ? orientation : OBJ_ORIENTATION_VPX;
  return { unit: unit || UNIT_CONVERSION_VPU, orientation: o };
}
