import { state, elements, isItemVisible, isItemSelected, dragRect, getItem, getItemByFileName } from './state.js';
import type { GameItem, DragPoint } from './state.js';
import { toScreen, updateZoomDisplay, initHitTestHandlers, HitTestHandler } from './utils.js';
import { objectTypes } from './object-types.js';
import {
  BACKGLASS_WIDTH,
  BACKGLASS_HEIGHT,
  DRAGPOINT_RADIUS,
  DRAGPOINT_COLOR_DRAGGING,
  DRAGPOINT_COLOR_SELECTED,
  DRAGPOINT_COLOR_DEFAULT,
  CAMERA_DEFAULT_FOV,
} from '../shared/constants.js';
import { getDragPointCoords } from '../types/game-objects.js';
import type { GameData } from '../types/data.js';
import {
  getEditable,
  hitTestBumper,
  hitTestDecal,
  hitTestFlasher,
  hitTestFlipper,
  hitTestLight,
  hitTestLightSequencer,
  hitTestRamp,
  hitTestReel,
  hitTestRubber,
  hitTestTextBox,
  hitTestTrigger,
  hitTestWall,
} from './parts/index.js';

initHitTestHandlers({
  hitTestBumper: hitTestBumper as HitTestHandler,
  hitTestDecal: hitTestDecal as HitTestHandler,
  hitTestFlasher: hitTestFlasher as HitTestHandler,
  hitTestFlipper: hitTestFlipper as HitTestHandler,
  hitTestLight: hitTestLight as HitTestHandler,
  hitTestLightSequencer: hitTestLightSequencer as HitTestHandler,
  hitTestRamp: hitTestRamp as HitTestHandler,
  hitTestReel: hitTestReel as HitTestHandler,
  hitTestRubber: hitTestRubber as HitTestHandler,
  hitTestTextBox: hitTestTextBox as HitTestHandler,
  hitTestTrigger: hitTestTrigger as HitTestHandler,
  hitTestWall: hitTestWall as HitTestHandler,
});

interface CameraParams {
  fov: number;
  inclination: number;
  layback: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
}

interface Vertex3D {
  x: number;
  y: number;
  z: number;
}

type BackglassViewMode = 'desktop' | 'fullscreen' | 'full_single_screen';

function getCameraParams(gd: GameData, viewMode: BackglassViewMode): CameraParams {
  const suffix =
    viewMode === 'desktop' ? '_desktop' : viewMode === 'fullscreen' ? '_fullscreen' : '_full_single_screen';
  return {
    fov: (gd[`bg_fov${suffix}`] as number | undefined) ?? CAMERA_DEFAULT_FOV,
    inclination: (gd[`bg_inclination${suffix}`] as number | undefined) ?? 0,
    layback: (gd[`bg_layback${suffix}`] as number | undefined) ?? 0,
    rotation: (gd[`bg_rotation${suffix}`] as number | undefined) ?? 0,
    scaleX: (gd[`bg_scale_x${suffix}`] as number | undefined) ?? 1,
    scaleY: (gd[`bg_scale_y${suffix}`] as number | undefined) ?? 1,
    scaleZ: (gd[`bg_scale_z${suffix}`] as number | undefined) ?? 1,
    offsetX: (gd[`bg_offset_x${suffix}`] as number | undefined) ?? 0,
    offsetY: (gd[`bg_offset_y${suffix}`] as number | undefined) ?? 30,
    offsetZ: (gd[`bg_offset_z${suffix}`] as number | undefined) ?? -200,
  };
}

function render3DProjection(ctx: CanvasRenderingContext2D): void {
  if (!state.gamedata) return;
  const gd = state.gamedata as GameData;

  const viewMode = (state.backglassViewMode || 'desktop') as BackglassViewMode;
  const cam = getCameraParams(gd, viewMode);

  const glassTopHeight = gd.glass_top_height ?? 210;
  const glassBottomHeight = gd.glass_bottom_height ?? 210;
  const tableWidth = (gd.right ?? 0) - (gd.left ?? 0);
  const tableHeight = (gd.bottom ?? 0) - (gd.top ?? 0);
  const tableCenterX = tableWidth / 2;

  const fovRad = (cam.fov * Math.PI) / 180;
  const aspect = BACKGLASS_WIDTH / BACKGLASS_HEIGHT;

  const inclineRad = (cam.inclination * Math.PI) / 180;
  const laybackRad = (cam.layback * Math.PI) / 180;
  const rotationRad = (cam.rotation * Math.PI) / 180;

  const camY = tableHeight + cam.offsetY;
  const camZ = 1500 + cam.offsetZ;

  const cosInc = Math.cos(inclineRad);
  const sinInc = Math.sin(inclineRad);
  const cosRot = Math.cos(rotationRad);
  const sinRot = Math.sin(rotationRad);

  function project(x: number, y: number, z: number): ProjectedPoint | null {
    let px = (x - tableCenterX) * cam.scaleX;
    let py = (y - tableHeight / 2) * cam.scaleY;
    let pz = z * cam.scaleZ;

    if (rotationRad !== 0) {
      const rx = px * cosRot - py * sinRot;
      const ry = px * sinRot + py * cosRot;
      px = rx;
      py = ry;
    }

    py = py + tableHeight / 2 - camY;
    pz = pz - camZ;

    const rotY = py * cosInc - pz * sinInc;
    const rotZ = py * sinInc + pz * cosInc;

    if (rotZ >= -1) return null;

    const fovScale = 1 / Math.tan(fovRad / 2);
    let xp = (px * fovScale) / (aspect * -rotZ);
    let yp = (rotY * fovScale) / -rotZ;

    yp += laybackRad * 0.5;

    const sx = (1 + xp + cam.offsetX / 500) * (BACKGLASS_WIDTH / 2);
    const sy = (1 + yp) * (BACKGLASS_HEIGHT / 2);

    return { x: sx, y: sy };
  }

  const vertices: Vertex3D[] = [
    { x: 0, y: 0, z: 50 },
    { x: 0, y: 0, z: glassTopHeight },
    { x: tableWidth, y: 0, z: glassTopHeight },
    { x: tableWidth, y: 0, z: 50 },
    { x: tableWidth, y: tableHeight, z: 50 },
    { x: tableWidth, y: tableHeight, z: glassBottomHeight },
    { x: 0, y: tableHeight, z: glassBottomHeight },
    { x: 0, y: tableHeight, z: 50 },
  ];

  const points = vertices.map(v => project(v.x, v.y, v.z)).filter((p): p is ProjectedPoint => p !== null);
  if (points.length < 3) return;

  ctx.save();
  ctx.fillStyle = 'rgb(200, 200, 200)';
  ctx.beginPath();
  const p0 = toScreen(points[0].x, points[0].y);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < points.length; i++) {
    const p = toScreen(points[i].x, points[i].y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function fitToView(): void {
  if (!state.gamedata || !elements.canvas) return;
  const gd = state.gamedata as GameData;

  const playWidth = state.backglassView ? BACKGLASS_WIDTH : (gd.right ?? 0) - (gd.left ?? 0);
  const playHeight = state.backglassView ? BACKGLASS_HEIGHT : (gd.bottom ?? 0) - (gd.top ?? 0);

  const scaleX = (elements.canvas.width - 40) / playWidth;
  const scaleY = (elements.canvas.height - 40) / playHeight;
  state.zoom = Math.min(scaleX, scaleY);

  state.panX = (elements.canvas.width - playWidth * state.zoom) / 2;
  state.panY = (elements.canvas.height - playHeight * state.zoom) / 2;

  updateZoomDisplay();
  render();
}

export function resize2D(oldWidth: number, oldHeight: number, newWidth: number, newHeight: number): void {
  if (!state.gamedata) return;

  const deltaX = (newWidth - oldWidth) / 2;
  const deltaY = (newHeight - oldHeight) / 2;

  state.panX += deltaX;
  state.panY += deltaY;

  render();
}

export function render(): void {
  if (!elements.ctx || !elements.canvas) return;
  const ctx = elements.ctx;
  const canvas = elements.canvas;

  const canvasBg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#1a1a1a';
  ctx.fillStyle = canvasBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!state.gamedata) return;
  const gd = state.gamedata as GameData;

  const playWidth = state.backglassView ? BACKGLASS_WIDTH : (gd.right ?? 0) - (gd.left ?? 0);
  const playHeight = state.backglassView ? BACKGLASS_HEIGHT : (gd.bottom ?? 0) - (gd.top ?? 0);
  const { x: px, y: py } = toScreen(0, 0);

  ctx.fillStyle = state.editorColors?.tableBackground || '#8d8d8d';
  ctx.fillRect(px, py, playWidth * state.zoom, playHeight * state.zoom);

  if (state.showBackdrop && state.backdropImage && !state.backglassView) {
    ctx.drawImage(state.backdropImage, px, py, playWidth * state.zoom, playHeight * state.zoom);
  }

  ctx.strokeStyle = state.backglassView ? '#000000' : state.editorColors?.tableBackground || '#8d8d8d';
  ctx.lineWidth = state.backglassView ? 2 : 2;
  ctx.strokeRect(px, py, playWidth * state.zoom, playHeight * state.zoom);

  if (state.backglassView) {
    render3DProjection(ctx);
  }

  if (state.showGrid) {
    renderGrid(playWidth, playHeight);
  }

  for (const gi of state.gameitems) {
    if (!gi.file_name) continue;
    const item = getItemByFileName(gi.file_name);
    if (!item) continue;
    const name = item.name || gi.file_name;
    if (!isItemVisible(item, name)) continue;
    renderItem(name, item);
  }

  if (state.alwaysDrawDragPoints) {
    for (const [name, item] of Object.entries(state.items)) {
      if (!isItemVisible(item, name)) continue;
      if (item.drag_points && item.drag_points.length > 0) {
        renderControlPoints(item, name);
      }
    }
  } else if (state.selectedItems.length > 0) {
    for (const itemName of state.selectedItems) {
      const item = getItem(itemName);
      if (item && item.drag_points && item.drag_points.length > 0 && isItemVisible(item, itemName)) {
        renderControlPoints(item, itemName);
      }
    }
  }

  if (dragRect.active) {
    const start = toScreen(dragRect.startX, dragRect.startY);
    const end = toScreen(dragRect.endX, dragRect.endY);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    ctx.setLineDash([]);
  }
}

function renderGrid(playWidth: number, playHeight: number): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;
  const gridSize = state.gridSize;
  if (gridSize <= 0) return;

  ctx.strokeStyle = 'rgba(190, 220, 240, 0.3)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= playWidth; x += gridSize) {
    const { x: sx, y: sy } = toScreen(x, 0);
    const { y: ey } = toScreen(x, playHeight);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, ey);
    ctx.stroke();
  }

  for (let y = 0; y <= playHeight; y += gridSize) {
    const { x: sx, y: sy } = toScreen(0, y);
    const { x: ex } = toScreen(playWidth, y);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, sy);
    ctx.stroke();
  }
}

interface ItemWithDragPoints extends GameItem {
  drag_points?: DragPoint[];
}

interface ItemWithCenter extends GameItem {
  center?: { x: number; y: number };
  vCenter?: { x: number; y: number };
}

function renderItem(name: string, item: GameItem): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;
  const isSelected = isItemSelected(name);

  ctx.save();

  try {
    const renderer = getEditable(item._type);
    if (renderer) {
      renderer.render(item, isSelected);
    } else if ((item as ItemWithCenter).center) {
      renderGenericCenter(item as ItemWithCenter, isSelected);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`Failed to render ${name} (${item._type}):`, message);
  }

  ctx.restore();
}

function renderGenericCenter(item: ItemWithCenter, isSelected: boolean): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;
  const center = item.center || item.vCenter;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);

  ctx.fillStyle = isSelected ? '#ffff00' : '#888800';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

interface SelectedNode {
  itemName: string;
  nodeIndex: number;
}

interface ObjectTypeConfig {
  dragPointColor?: string;
  dragPointFirstColor?: string;
}

function renderControlPoints(item: ItemWithDragPoints, itemName: string): void {
  if (!elements.ctx) return;
  const ctx = elements.ctx;
  if (!item.drag_points || item.drag_points.length === 0) return;

  const typeConfig = objectTypes[item._type] as ObjectTypeConfig | undefined;
  const baseColor = typeConfig?.dragPointColor || DRAGPOINT_COLOR_DEFAULT;
  const firstColor = typeConfig?.dragPointFirstColor;

  for (let i = 0; i < item.drag_points.length; i++) {
    const pt = item.drag_points[i];
    const { x, y } = getDragPointCoords(pt);
    const { x: sx, y: sy } = toScreen(x, y);

    const selectedNode = state.selectedNode as SelectedNode | null;
    const isSelectedNode = selectedNode && selectedNode.itemName === itemName && selectedNode.nodeIndex === i;
    const isDragging = state.draggingNode && isSelectedNode;

    let strokeColor: string;
    if (isDragging) {
      strokeColor = DRAGPOINT_COLOR_DRAGGING;
    } else if (i === 0 && firstColor) {
      strokeColor = firstColor;
    } else {
      strokeColor = baseColor;
    }

    ctx.beginPath();
    ctx.arc(sx, sy, DRAGPOINT_RADIUS, 0, Math.PI * 2);
    if (isSelectedNode) {
      ctx.fillStyle = DRAGPOINT_COLOR_SELECTED;
      ctx.fill();
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
