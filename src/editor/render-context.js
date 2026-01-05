import { RENDER_COLOR_BLACK, RENDER_COLOR_GRAY, BLUEPRINT_SOLID_COLOR } from '../shared/constants.js';

export class RenderContext {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.scale = options.scale ?? 1;
    this.panX = options.panX ?? 0;
    this.panY = options.panY ?? 0;
    this.offsetX = options.offsetX ?? 0;
    this.offsetY = options.offsetY ?? 0;
    this.solid = options.solid ?? false;
    this.strokeColor = options.strokeColor ?? RENDER_COLOR_BLACK;
    this.fillColor = options.fillColor ?? BLUEPRINT_SOLID_COLOR;
    this.lineWidth = options.lineWidth ?? 1;
    this.isBlueprint = options.isBlueprint ?? false;
  }

  toScreen(x, y) {
    return {
      x: (x - this.panX) * this.scale + this.offsetX,
      y: (y - this.panY) * this.scale + this.offsetY,
    };
  }

  scaleValue(v) {
    return v * this.scale;
  }

  setStrokeStyle(color) {
    this.ctx.strokeStyle = color ?? this.strokeColor;
  }

  setFillStyle(color) {
    this.ctx.fillStyle = color ?? (this.solid ? this.fillColor : 'transparent');
  }

  setLineWidth(width) {
    this.ctx.lineWidth = width ?? this.lineWidth;
  }

  setLineDash(pattern) {
    this.ctx.setLineDash(pattern);
  }

  beginPath() {
    this.ctx.beginPath();
  }

  closePath() {
    this.ctx.closePath();
  }

  moveTo(x, y) {
    this.ctx.moveTo(x, y);
  }

  lineTo(x, y) {
    this.ctx.lineTo(x, y);
  }

  arc(x, y, radius, startAngle, endAngle, counterclockwise) {
    this.ctx.arc(x, y, radius, startAngle, endAngle, counterclockwise);
  }

  rect(x, y, w, h) {
    this.ctx.rect(x, y, w, h);
  }

  stroke() {
    this.ctx.stroke();
  }

  fill() {
    this.ctx.fill();
  }

  ellipse(cx, cy, radius) {
    this.beginPath();
    this.arc(cx, cy, radius, 0, Math.PI * 2);
    if (this.solid) {
      this.fill();
    }
    this.stroke();
  }

  line(x1, y1, x2, y2) {
    this.beginPath();
    this.moveTo(x1, y1);
    this.lineTo(x2, y2);
    this.stroke();
  }

  polygon(points, close = true) {
    if (points.length < 2) return;
    this.beginPath();
    this.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.lineTo(points[i].x, points[i].y);
    }
    if (close) {
      this.closePath();
    }
    if (this.solid) {
      this.fill();
    }
    this.stroke();
  }

  polyline(points) {
    if (points.length < 2) return;
    this.beginPath();
    this.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.lineTo(points[i].x, points[i].y);
    }
    this.stroke();
  }

  rectangle(x1, y1, x2, y2) {
    this.beginPath();
    this.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    if (this.solid) {
      this.fill();
    }
    this.stroke();
  }

  arcFromPoints(cx, cy, radius, x1, y1, x2, y2, counterclockwise = true) {
    const startAngle = Math.atan2(y1 - cy, x1 - cx);
    const endAngle = Math.atan2(y2 - cy, x2 - cx);
    this.beginPath();
    this.arc(cx, cy, radius, startAngle, endAngle, counterclockwise);
    this.stroke();
  }

  save() {
    this.ctx.save();
  }

  restore() {
    this.ctx.restore();
  }
}

export function createEditorContext(ctx, state, elements, isSelected, item) {
  const strokeColor = isSelected
    ? (item?.is_locked ? state.editorColors?.elementSelectLocked : state.editorColors?.elementSelect) || '#0000ff'
    : state.editorColors?.elementStroke || RENDER_COLOR_BLACK;

  return new RenderContext(ctx, {
    scale: state.zoom,
    panX: state.panX,
    panY: state.panY,
    offsetX: elements.canvas.width / 2,
    offsetY: elements.canvas.height / 2,
    solid: state.viewSolid,
    strokeColor,
    fillColor: state.editorColors?.elementFill || '#b1cfb3',
    lineWidth: isSelected ? 2 : 1,
    isBlueprint: false,
  });
}

export function createBlueprintContext(ctx, tableWidth, tableHeight, maxDimension, solid) {
  let scale;
  if (tableHeight > tableWidth) {
    scale = maxDimension / tableHeight;
  } else {
    scale = maxDimension / tableWidth;
  }

  return new RenderContext(ctx, {
    scale,
    panX: 0,
    panY: 0,
    offsetX: 0,
    offsetY: 0,
    solid,
    strokeColor: RENDER_COLOR_BLACK,
    fillColor: BLUEPRINT_SOLID_COLOR,
    lineWidth: 1,
    isBlueprint: true,
  });
}
