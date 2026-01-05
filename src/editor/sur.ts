import { RENDER_COLOR_BLACK, BLUEPRINT_SOLID_COLOR } from '../shared/constants.js';
import type { GameItem, EditorColors } from './state.js';
import type { Point } from '../types/game-objects.js';

export type { Point };

export interface SurOptions {
  scale?: number;
  panX?: number;
  panY?: number;
  offsetX?: number;
  offsetY?: number;
  solid?: boolean;
  strokeColor?: string;
  fillColor?: string;
  lineWidth?: number;
  isBlueprint?: boolean;
}

export class Sur {
  ctx: CanvasRenderingContext2D;
  scale: number;
  panX: number;
  panY: number;
  offsetX: number;
  offsetY: number;
  solid: boolean;
  strokeColor: string;
  fillColor: string;
  lineWidth: number;
  isBlueprint: boolean;

  constructor(ctx: CanvasRenderingContext2D, options: SurOptions = {}) {
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

  toScreen(x: number, y: number): Point {
    return {
      x: (x - this.panX) * this.scale + this.offsetX,
      y: (y - this.panY) * this.scale + this.offsetY,
    };
  }

  scaleValue(v: number): number {
    return v * this.scale;
  }

  setStrokeStyle(color?: string): void {
    this.ctx.strokeStyle = color ?? this.strokeColor;
  }

  setFillStyle(color?: string): void {
    this.ctx.fillStyle = color ?? (this.solid ? this.fillColor : 'transparent');
  }

  setLineWidth(width?: number): void {
    this.ctx.lineWidth = width ?? this.lineWidth;
  }

  setLineDash(pattern: number[]): void {
    this.ctx.setLineDash(pattern);
  }

  beginPath(): void {
    this.ctx.beginPath();
  }

  closePath(): void {
    this.ctx.closePath();
  }

  moveTo(x: number, y: number): void {
    this.ctx.moveTo(x, y);
  }

  lineTo(x: number, y: number): void {
    this.ctx.lineTo(x, y);
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.ctx.arc(x, y, radius, startAngle, endAngle, counterclockwise);
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.ctx.rect(x, y, w, h);
  }

  stroke(): void {
    this.ctx.stroke();
  }

  fill(): void {
    this.ctx.fill();
  }

  ellipse(cx: number, cy: number, radius: number): void {
    this.beginPath();
    this.arc(cx, cy, radius, 0, Math.PI * 2);
    if (this.solid) {
      this.fill();
    }
    this.stroke();
  }

  line(x1: number, y1: number, x2: number, y2: number): void {
    this.beginPath();
    this.moveTo(x1, y1);
    this.lineTo(x2, y2);
    this.stroke();
  }

  polygon(points: Point[], close: boolean = true): void {
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

  polyline(points: Point[]): void {
    if (points.length < 2) return;
    this.beginPath();
    this.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.lineTo(points[i].x, points[i].y);
    }
    this.stroke();
  }

  rectangle(x1: number, y1: number, x2: number, y2: number): void {
    this.beginPath();
    this.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    if (this.solid) {
      this.fill();
    }
    this.stroke();
  }

  arcFromPoints(
    cx: number,
    cy: number,
    radius: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    counterclockwise: boolean = true
  ): void {
    const startAngle = Math.atan2(y1 - cy, x1 - cx);
    const endAngle = Math.atan2(y2 - cy, x2 - cx);
    this.beginPath();
    this.arc(cx, cy, radius, startAngle, endAngle, counterclockwise);
    this.stroke();
  }

  save(): void {
    this.ctx.save();
  }

  restore(): void {
    this.ctx.restore();
  }
}

interface EditorContextState {
  zoom: number;
  panX: number;
  panY: number;
  viewSolid: boolean;
  editorColors: EditorColors;
}

interface EditorContextElements {
  canvas: HTMLCanvasElement | null;
}

export function createPaintSur(
  ctx: CanvasRenderingContext2D,
  state: EditorContextState,
  elements: EditorContextElements,
  isSelected: boolean,
  item?: GameItem
): Sur {
  const strokeColor = isSelected
    ? (item?.is_locked ? state.editorColors?.elementSelectLocked : state.editorColors?.elementSelect) || '#0000ff'
    : RENDER_COLOR_BLACK;

  return new Sur(ctx, {
    scale: state.zoom,
    panX: state.panX,
    panY: state.panY,
    offsetX: (elements.canvas?.width ?? 0) / 2,
    offsetY: (elements.canvas?.height ?? 0) / 2,
    solid: state.viewSolid,
    strokeColor,
    fillColor: state.editorColors?.elementFill || '#b1cfb3',
    lineWidth: isSelected ? 2 : 1,
    isBlueprint: false,
  });
}

export function createBlueprintSur(
  ctx: CanvasRenderingContext2D,
  tableWidth: number,
  tableHeight: number,
  maxDimension: number,
  solid: boolean
): Sur {
  let scale: number;
  if (tableHeight > tableWidth) {
    scale = maxDimension / tableHeight;
  } else {
    scale = maxDimension / tableWidth;
  }

  return new Sur(ctx, {
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
