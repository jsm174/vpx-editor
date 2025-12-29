import { state, elements, isItemVisible, isItemSelected, dragRect } from './state.js';
import { toScreen, updateZoomDisplay, getItemNameFromFileName } from './utils.js';
import { objectTypes } from './object-types.js';
import {
  renderFlipper,
  renderBumper,
  renderLight,
  renderKicker,
  renderWall,
  renderRubber,
  renderRamp,
  renderGate,
  renderSpinner,
  renderHitTarget,
  renderTrigger,
  renderPlunger,
  renderFlasher,
  renderTimer,
  renderDecal,
  renderTextBox,
  renderPrimitive,
  renderReel,
  renderLightSequencer,
  renderBall,
  renderPartGroup,
} from './objects/index.js';

const BACKGLASS_WIDTH = 1000;
const BACKGLASS_HEIGHT = 750;

const DRAGPOINT_RADIUS = 8;
const DRAGPOINT_COLOR_DRAGGING = '#00ff00';
const DRAGPOINT_COLOR_SELECTED_FILL = '#96c8ff';
const DRAGPOINT_COLOR_DEFAULT = '#ff0000';

function getCameraParams(gd, viewMode) {
  const suffix =
    viewMode === 'desktop' ? '_desktop' : viewMode === 'fullscreen' ? '_fullscreen' : '_full_single_screen';
  return {
    fov: gd[`bg_fov${suffix}`] ?? 45,
    inclination: gd[`bg_inclination${suffix}`] ?? 0,
    layback: gd[`bg_layback${suffix}`] ?? 0,
    rotation: gd[`bg_rotation${suffix}`] ?? 0,
    scaleX: gd[`bg_scale_x${suffix}`] ?? 1,
    scaleY: gd[`bg_scale_y${suffix}`] ?? 1,
    scaleZ: gd[`bg_scale_z${suffix}`] ?? 1,
    offsetX: gd[`bg_offset_x${suffix}`] ?? 0,
    offsetY: gd[`bg_offset_y${suffix}`] ?? 30,
    offsetZ: gd[`bg_offset_z${suffix}`] ?? -200,
  };
}

function render3DProjection(ctx) {
  const gd = state.gamedata;
  if (!gd) return;

  const viewMode = state.backglassViewMode || 'desktop';
  const cam = getCameraParams(gd, viewMode);

  const glassTopHeight = gd.glass_top_height ?? 210;
  const glassBottomHeight = gd.glass_bottom_height ?? 210;
  const tableWidth = gd.right - gd.left;
  const tableHeight = gd.bottom - gd.top;
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

  function project(x, y, z) {
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

  const vertices = [
    { x: 0, y: 0, z: 50 },
    { x: 0, y: 0, z: glassTopHeight },
    { x: tableWidth, y: 0, z: glassTopHeight },
    { x: tableWidth, y: 0, z: 50 },
    { x: tableWidth, y: tableHeight, z: 50 },
    { x: tableWidth, y: tableHeight, z: glassBottomHeight },
    { x: 0, y: tableHeight, z: glassBottomHeight },
    { x: 0, y: tableHeight, z: 50 },
  ];

  const points = vertices.map(v => project(v.x, v.y, v.z)).filter(p => p !== null);
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

export function fitToView() {
  if (!state.gamedata) return;

  const playWidth = state.backglassView ? BACKGLASS_WIDTH : state.gamedata.right - state.gamedata.left;
  const playHeight = state.backglassView ? BACKGLASS_HEIGHT : state.gamedata.bottom - state.gamedata.top;

  const scaleX = (elements.canvas.width - 40) / playWidth;
  const scaleY = (elements.canvas.height - 40) / playHeight;
  state.zoom = Math.min(scaleX, scaleY);

  state.panX = (elements.canvas.width - playWidth * state.zoom) / 2;
  state.panY = (elements.canvas.height - playHeight * state.zoom) / 2;

  updateZoomDisplay();
  render();
}

export function resize2D(oldWidth, oldHeight, newWidth, newHeight) {
  if (!state.gamedata) return;

  const deltaX = (newWidth - oldWidth) / 2;
  const deltaY = (newHeight - oldHeight) / 2;

  state.panX += deltaX;
  state.panY += deltaY;

  render();
}

export function render() {
  const canvasBg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#1a1a1a';
  elements.ctx.fillStyle = canvasBg;
  elements.ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);

  if (!state.gamedata) return;

  const playWidth = state.backglassView ? BACKGLASS_WIDTH : state.gamedata.right - state.gamedata.left;
  const playHeight = state.backglassView ? BACKGLASS_HEIGHT : state.gamedata.bottom - state.gamedata.top;
  const { x: px, y: py } = toScreen(0, 0);

  elements.ctx.fillStyle = state.editorColors?.tableBackground || '#8d8d8d';
  elements.ctx.fillRect(px, py, playWidth * state.zoom, playHeight * state.zoom);

  if (state.showBackdrop && state.backdropImage && !state.backglassView) {
    elements.ctx.drawImage(state.backdropImage, px, py, playWidth * state.zoom, playHeight * state.zoom);
  }

  elements.ctx.strokeStyle = state.backglassView ? '#000000' : state.editorColors?.tableBackground || '#8d8d8d';
  elements.ctx.lineWidth = state.backglassView ? 2 : 2;
  elements.ctx.strokeRect(px, py, playWidth * state.zoom, playHeight * state.zoom);

  if (state.backglassView) {
    render3DProjection(elements.ctx);
  }

  if (state.showGrid) {
    renderGrid(playWidth, playHeight);
  }

  for (const gi of state.gameitems) {
    if (!gi.file_name) continue;
    const name = getItemNameFromFileName(gi.file_name);
    const item = state.items[name];
    if (!item || !isItemVisible(item, name)) continue;
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
      const item = state.items[itemName];
      if (item && item.drag_points && item.drag_points.length > 0 && isItemVisible(item, itemName)) {
        renderControlPoints(item, itemName);
      }
    }
  }

  if (dragRect.active) {
    const start = toScreen(dragRect.startX, dragRect.startY);
    const end = toScreen(dragRect.endX, dragRect.endY);
    elements.ctx.strokeStyle = '#000';
    elements.ctx.lineWidth = 1;
    elements.ctx.setLineDash([4, 4]);
    elements.ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    elements.ctx.setLineDash([]);
  }
}

function renderGrid(playWidth, playHeight) {
  const gridSize = state.gridSize;
  if (gridSize <= 0) return;

  elements.ctx.strokeStyle = 'rgba(190, 220, 240, 0.3)';
  elements.ctx.lineWidth = 1;

  for (let x = 0; x <= playWidth; x += gridSize) {
    const { x: sx, y: sy } = toScreen(x, 0);
    const { y: ey } = toScreen(x, playHeight);
    elements.ctx.beginPath();
    elements.ctx.moveTo(sx, sy);
    elements.ctx.lineTo(sx, ey);
    elements.ctx.stroke();
  }

  for (let y = 0; y <= playHeight; y += gridSize) {
    const { x: sx, y: sy } = toScreen(0, y);
    const { x: ex } = toScreen(playWidth, y);
    elements.ctx.beginPath();
    elements.ctx.moveTo(sx, sy);
    elements.ctx.lineTo(ex, sy);
    elements.ctx.stroke();
  }
}

function renderItem(name, item) {
  const isSelected = isItemSelected(name);

  elements.ctx.save();

  try {
    switch (item._type) {
      case 'Flipper':
        if (item.center) renderFlipper(item, isSelected);
        break;
      case 'Bumper':
        if (item.center) renderBumper(item, isSelected);
        break;
      case 'Light':
        renderLight(item, isSelected);
        break;
      case 'Kicker':
        if (item.center) renderKicker(item, isSelected);
        break;
      case 'Wall':
      case 'Surface':
        renderWall(item, isSelected);
        break;
      case 'Rubber':
        renderRubber(item, isSelected);
        break;
      case 'Trigger':
        renderTrigger(item, isSelected);
        break;
      case 'Gate':
        if (item.center) renderGate(item, isSelected);
        break;
      case 'Spinner':
        if (item.center) renderSpinner(item, isSelected);
        break;
      case 'HitTarget':
        renderHitTarget(item, isSelected);
        break;
      case 'Ramp':
        renderRamp(item, isSelected);
        break;
      case 'Primitive':
        renderPrimitive(item, isSelected);
        break;
      case 'Plunger':
        if (item.center) renderPlunger(item, isSelected);
        break;
      case 'Flasher':
        renderFlasher(item, isSelected);
        break;
      case 'Timer':
        renderTimer(item, isSelected);
        break;
      case 'Decal':
        renderDecal(item, isSelected);
        break;
      case 'TextBox':
        renderTextBox(item, isSelected);
        break;
      case 'Reel':
        renderReel(item, isSelected);
        break;
      case 'LightSequencer':
        renderLightSequencer(item, isSelected);
        break;
      case 'Ball':
        renderBall(item, isSelected);
        break;
      default:
        if (item.center) {
          renderGenericCenter(item, isSelected);
        }
    }
  } catch (e) {
    console.warn(`Failed to render ${name} (${item._type}):`, e.message);
  }

  elements.ctx.restore();
}

function renderGenericCenter(item, isSelected) {
  const center = item.center || item.vCenter;
  if (!center) return;

  const { x: cx, y: cy } = toScreen(center.x, center.y);

  elements.ctx.fillStyle = isSelected ? '#ffff00' : '#888800';
  elements.ctx.beginPath();
  elements.ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  elements.ctx.fill();
}

function renderControlPoints(item, itemName) {
  if (!item.drag_points || item.drag_points.length === 0) return;

  const typeConfig = objectTypes[item._type];
  const baseColor = typeConfig?.dragPointColor || DRAGPOINT_COLOR_DEFAULT;
  const firstColor = typeConfig?.dragPointFirstColor;

  for (let i = 0; i < item.drag_points.length; i++) {
    const pt = item.drag_points[i];
    const v = pt.vertex || pt;
    const { x: sx, y: sy } = toScreen(v.x, v.y);

    const isSelectedNode =
      state.selectedNode && state.selectedNode.itemName === itemName && state.selectedNode.nodeIndex === i;
    const isDragging = state.draggingNode && isSelectedNode;

    let strokeColor;
    if (isDragging) {
      strokeColor = DRAGPOINT_COLOR_DRAGGING;
    } else if (i === 0 && firstColor) {
      strokeColor = firstColor;
    } else {
      strokeColor = baseColor;
    }

    elements.ctx.beginPath();
    elements.ctx.arc(sx, sy, DRAGPOINT_RADIUS, 0, Math.PI * 2);
    if (isSelectedNode) {
      elements.ctx.fillStyle = DRAGPOINT_COLOR_SELECTED_FILL;
      elements.ctx.fill();
    }
    elements.ctx.strokeStyle = strokeColor;
    elements.ctx.lineWidth = 1;
    elements.ctx.stroke();
  }
}
