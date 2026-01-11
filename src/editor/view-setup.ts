import * as THREE from 'three';
import type { GameData } from '../types/data.js';

export type ViewMode = 'desktop' | 'fullscreen' | 'cabinet' | 'mixedreality' | 'vr';
export type SpaceReference = 'playfield' | 'inherit' | string;

export interface ViewSetup {
  mode?: string;
  fov: number;
  inclination?: number;
  layback?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  hOfs?: number;
  vOfs?: number;
  eyeHeight?: number;
  standBack?: number;
  windowTopZ?: number;
  windowBotZ?: number;
}

export interface CameraParams {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export interface VisibilityMask {
  desktop: number;
  fullSingleScreen: number;
  cabinet: number;
  mixedReality: number;
  virtualReality: number;
}

export interface ViewModesMasks {
  desktop: number;
  fullscreen: number;
  cabinet: number;
  mixedreality: number;
  vr: number;
  [key: string]: number;
}

interface ViewDefaults {
  desktop: ViewSetup;
  fullscreen: ViewSetup;
  cabinet: ViewSetup;
  vr: ViewSetup;
  [key: string]: ViewSetup;
}

export const CMTOVPU = (cm: number): number => cm * (50 / (2.54 * 1.0625));
export const GROUND_TO_LOCKBAR_HEIGHT: number = CMTOVPU(91);

export function getSpaceReferenceOffset(gamedata: GameData | null, spaceReference: SpaceReference | null): number {
  if (!spaceReference || spaceReference === 'playfield' || spaceReference === 'inherit') {
    return 0;
  }
  const glassBottomHeight = gamedata?.glass_bottom_height ?? 117.65;
  return -(GROUND_TO_LOCKBAR_HEIGHT - glassBottomHeight);
}

export const VISIBILITY_MASK: VisibilityMask = {
  desktop: 0x0001,
  fullSingleScreen: 0x0002,
  cabinet: 0x0004,
  mixedReality: 0x0008,
  virtualReality: 0x0010,
};

export const VIEW_MODE_MASKS: ViewModesMasks = {
  desktop: VISIBILITY_MASK.desktop,
  fullscreen: VISIBILITY_MASK.fullSingleScreen,
  cabinet: VISIBILITY_MASK.cabinet,
  mixedreality: VISIBILITY_MASK.mixedReality,
  vr: VISIBILITY_MASK.virtualReality,
};

const VIEW_DEFAULTS: ViewDefaults = {
  desktop: {
    mode: 'camera',
    fov: 50.0,
    inclination: 25.0,
    layback: 0.0,
    offsetX: 0,
    offsetY: 370.5,
    offsetZ: 1296.9,
    scaleX: 1.0,
    scaleY: 1.0,
    scaleZ: 1.0,
    hOfs: 0.0,
    vOfs: 14.0,
  },
  fullscreen: {
    mode: 'camera',
    fov: 77.0,
    inclination: 50.0,
    layback: 15.0,
    offsetX: 0,
    offsetY: 370.5,
    offsetZ: 1296.9,
    scaleX: 1.0,
    scaleY: 1.0,
    scaleZ: 1.0,
    hOfs: 0.0,
    vOfs: 22.0,
  },
  cabinet: {
    mode: 'window',
    fov: 77.0,
    inclination: 25.0,
    layback: 70.0,
    offsetX: 0,
    offsetY: 370.5,
    offsetZ: 1482.0,
    scaleX: 1.2,
    scaleY: 1.2,
    scaleZ: 1.2,
    hOfs: 0.0,
    vOfs: 1.4,
    windowTopZ: 263.5,
    windowBotZ: 139.0,
  },
  vr: {
    fov: 60.0,
    eyeHeight: 2970,
    standBack: 926,
  },
};

export function getViewSetup(gamedata: GameData | null, viewMode: ViewMode): ViewSetup {
  const defaults = VIEW_DEFAULTS[viewMode] || VIEW_DEFAULTS.desktop;

  if (!gamedata) return { ...defaults };

  const suffixMap: Record<string, string> = {
    desktop: '_desktop',
    fullscreen: '_full_single_screen',
    cabinet: '_fullscreen',
    mixedreality: '_fullscreen',
    vr: '_desktop',
  };
  const suffix: string = suffixMap[viewMode] || '_desktop';

  if (viewMode === 'vr') {
    return { ...defaults };
  }

  return {
    mode: (gamedata[`bg_view_mode${suffix}`] as string) || defaults.mode,
    fov: (gamedata[`bg_fov${suffix}`] as number) ?? defaults.fov,
    inclination: (gamedata[`bg_inclination${suffix}`] as number) ?? defaults.inclination,
    layback: (gamedata[`bg_layback${suffix}`] as number) ?? defaults.layback,
    offsetX: (gamedata[`bg_offset_x${suffix}`] as number) ?? defaults.offsetX,
    offsetY: (gamedata[`bg_offset_y${suffix}`] as number) ?? defaults.offsetY,
    offsetZ: (gamedata[`bg_offset_z${suffix}`] as number) ?? defaults.offsetZ,
    scaleX: (gamedata[`bg_scale_x${suffix}`] as number) ?? defaults.scaleX,
    scaleY: (gamedata[`bg_scale_y${suffix}`] as number) ?? defaults.scaleY,
    scaleZ: (gamedata[`bg_scale_z${suffix}`] as number) ?? defaults.scaleZ,
    hOfs: (gamedata[`bg_view_horizontal_offset${suffix}`] as number) ?? defaults.hOfs,
    vOfs: (gamedata[`bg_view_vertical_offset${suffix}`] as number) ?? defaults.vOfs,
    windowTopZ: (gamedata[`bg_window_top_z_offset${suffix}`] as number) ?? defaults.windowTopZ,
    windowBotZ: (gamedata[`bg_window_bottom_z_offset${suffix}`] as number) ?? defaults.windowBotZ,
  };
}

export function computeCameraParams(gamedata: GameData | null, viewMode: ViewMode): CameraParams {
  const tableWidth = gamedata?.right || 952;
  const tableHeight = gamedata?.bottom || 2162;
  const viewSetup = getViewSetup(gamedata, viewMode);

  switch (viewMode) {
    case 'desktop':
      return computeDesktopCamera(viewSetup, tableWidth, tableHeight);
    case 'fullscreen':
    case 'mixedreality':
      return computeFullscreenCamera(viewSetup, tableWidth, tableHeight);
    case 'cabinet':
      return computeCabinetCamera(viewSetup, tableWidth, tableHeight);
    case 'vr':
      return computeVRCamera(viewSetup, tableWidth, tableHeight);
    default:
      return computeDesktopCamera(viewSetup, tableWidth, tableHeight);
  }
}

function computeDesktopCamera(_setup: ViewSetup, tableW: number, tableH: number): CameraParams {
  const centerX = tableW / 2;
  const centerY = tableH / 2;
  const fov = 50;
  const halfFovRad = (fov / 2) * (Math.PI / 180);
  const distance = (tableH / 2 / Math.tan(halfFovRad)) * 1.15;
  const inclination = 25 * (Math.PI / 180);

  const camY = centerY + distance * Math.sin(inclination);
  const camZ = distance * Math.cos(inclination);

  return {
    position: new THREE.Vector3(centerX, -camY, camZ),
    target: new THREE.Vector3(centerX, -centerY, 0),
    fov: fov,
  };
}

function computeFullscreenCamera(_setup: ViewSetup, tableW: number, tableH: number): CameraParams {
  const centerX = tableW / 2;
  const camY = tableH + 400;
  const camZ = 1300;
  const lookAtY = tableH * 0.5;

  return {
    position: new THREE.Vector3(centerX, -camY, camZ),
    target: new THREE.Vector3(centerX, -lookAtY, 0),
    fov: 77,
  };
}

function computeCabinetCamera(_setup: ViewSetup, tableW: number, tableH: number): CameraParams {
  const centerX = tableW / 2;
  const centerY = tableH / 2;
  const camZ = tableH * 1.3;
  const tiltOffset = tableH * 0.05;

  return {
    position: new THREE.Vector3(centerX, -(centerY + tiltOffset), camZ),
    target: new THREE.Vector3(centerX, -centerY, 0),
    fov: 45,
  };
}

function computeVRCamera(setup: ViewSetup, tableW: number, tableH: number): CameraParams {
  const centerX = tableW / 2;
  const eyeHeight = setup.eyeHeight || 0;
  const standBack = setup.standBack || 0;

  return {
    position: new THREE.Vector3(centerX, -(tableH + standBack), eyeHeight),
    target: new THREE.Vector3(centerX, -tableH * 0.4, 0),
    fov: setup.fov,
  };
}
