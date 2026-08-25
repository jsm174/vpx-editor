import {
  DEFAULT_OBJ_ORIENTATION,
  DEFAULT_OBJ_UNIT,
  OBJ_ORIENTATION_VPX,
  OBJ_ORIENTATION_Y_UP_RH,
  UNIT_CONVERSION_M,
  UNIT_CONVERSION_VPU,
} from './constants.js';
import type { ObjExchangeOptions } from './obj-transform.js';

export interface ObjProfile {
  value: string;
  label: string;
  hint: string;
  options: ObjExchangeOptions;
}

const OBJ_PROFILE_BLENDER = 'blender';
const OBJ_PROFILE_VPX = 'vpx';

export const OBJ_PROFILES: ObjProfile[] = [
  {
    value: OBJ_PROFILE_VPX,
    label: 'VPUnits (Up -Z, Visual Pinball default)',
    hint: 'Recommended Blender Import / Export Transformations:\nScale 0.00054, Forward -Y, Up -Z',
    options: { unit: UNIT_CONVERSION_VPU, orientation: OBJ_ORIENTATION_VPX },
  },
  {
    value: OBJ_PROFILE_BLENDER,
    label: 'Meters (Up Y, Blender default)',
    hint: "Matches Blender's default Import / Export Transformations:\nScale 1.0, Forward -Z, Up Y. Primitive scale stays 1.",
    options: { unit: UNIT_CONVERSION_M, orientation: OBJ_ORIENTATION_Y_UP_RH },
  },
];

export const DEFAULT_OBJ_EXCHANGE: ObjExchangeOptions = {
  unit: DEFAULT_OBJ_UNIT,
  orientation: DEFAULT_OBJ_ORIENTATION,
};

const defaultProfile = (): ObjProfile =>
  OBJ_PROFILES.find(p => p.options.unit === DEFAULT_OBJ_UNIT && p.options.orientation === DEFAULT_OBJ_ORIENTATION)!;

export function profileFor(options: ObjExchangeOptions): ObjProfile {
  return (
    OBJ_PROFILES.find(p => p.options.unit === options.unit && p.options.orientation === options.orientation) ??
    defaultProfile()
  );
}

export function optionsForProfile(value: string): ObjExchangeOptions {
  return (OBJ_PROFILES.find(p => p.value === value) ?? defaultProfile()).options;
}

export function objProfileRadiosHtml(name: string, options: ObjExchangeOptions): string {
  const selected = profileFor(options).value;
  const radios = OBJ_PROFILES.map(
    p => `<label class="obj-profile-radio">
      <input type="radio" name="${name}" value="${p.value}"${p.value === selected ? ' checked' : ''}>
      <span class="obj-profile-radio-text">
        <span class="obj-profile-radio-label">${p.label}</span>
        <span class="obj-profile-radio-hint">${p.hint}</span>
      </span>
    </label>`
  ).join('');
  return `<div class="obj-profile-radios" id="${name}">${radios}</div>`;
}

export function getObjProfileValue(root: ParentNode, name: string): string {
  const checked = root.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement | null;
  return checked?.value ?? defaultProfile().value;
}

export function setObjProfileValue(root: ParentNode, name: string, value: string): void {
  const radio = root.querySelector(`input[name="${name}"][value="${value}"]`) as HTMLInputElement | null;
  if (radio) radio.checked = true;
}
