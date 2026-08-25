import { UNIT_CONVERSION_INCHES, UNIT_CONVERSION_M, UNIT_CONVERSION_MM, UNIT_CONVERSION_VPU } from './constants.js';

export type UnitConversion = typeof UNIT_CONVERSION_INCHES | typeof UNIT_CONVERSION_MM | typeof UNIT_CONVERSION_VPU;

export const VPU_PER_INCH = 50 / 1.0625;
export const VPU_PER_MM = 50 / (25.4 * 1.0625);
export const VPU_PER_M = VPU_PER_MM * 1000;

export function vpUnitsToInches(value: number): number {
  return value / VPU_PER_INCH;
}

export function vpUnitsToMillimeters(value: number): number {
  return value / VPU_PER_MM;
}

export function inchesToVpUnits(value: number): number {
  return value * VPU_PER_INCH;
}

export function millimetersToVpUnits(value: number): number {
  return value * VPU_PER_MM;
}

export function vpUnitsToMeters(value: number): number {
  return value / VPU_PER_M;
}

export function metersToVpUnits(value: number): number {
  return value * VPU_PER_M;
}

export function vpUnitsToUnit(value: number, unit: string): number {
  switch (unit) {
    case UNIT_CONVERSION_INCHES:
      return vpUnitsToInches(value);
    case UNIT_CONVERSION_MM:
      return vpUnitsToMillimeters(value);
    case UNIT_CONVERSION_M:
      return vpUnitsToMeters(value);
    default:
      return value;
  }
}

export function unitToVpUnits(value: number, unit: string): number {
  switch (unit) {
    case UNIT_CONVERSION_INCHES:
      return inchesToVpUnits(value);
    case UNIT_CONVERSION_MM:
      return millimetersToVpUnits(value);
    case UNIT_CONVERSION_M:
      return metersToVpUnits(value);
    default:
      return value;
  }
}

export function getUnitLabelFor(unit: string): string {
  switch (unit) {
    case UNIT_CONVERSION_INCHES:
      return 'in';
    case UNIT_CONVERSION_MM:
      return 'mm';
    case UNIT_CONVERSION_M:
      return 'm';
    default:
      return 'vpu';
  }
}

export function getUnitSuffixHtmlFor(unit: string): string {
  if (unit === UNIT_CONVERSION_VPU) {
    return '';
  }
  return `<span class="prop-unit">(${getUnitLabelFor(unit)})</span>`;
}

export function getUnitTextSuffixFor(unit: string): string {
  switch (unit) {
    case UNIT_CONVERSION_INCHES:
      return ' (inch)';
    case UNIT_CONVERSION_MM:
      return ' (mm)';
    default:
      return '';
  }
}

export function getUnitCompactSuffixFor(unit: string): string {
  switch (unit) {
    case UNIT_CONVERSION_INCHES:
      return '"';
    case UNIT_CONVERSION_MM:
      return ' mm';
    default:
      return '';
  }
}
