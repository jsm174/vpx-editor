import type { Point } from '../types/game-objects.js';

export enum SelectState {
  eNotSelected = 0,
  eSelected = 1,
  eMultiSelected = 2,
}

export const SELECT_LEVEL_OBJECT = 1 as const;
export const SELECT_LEVEL_DRAGPOINT = 2 as const;

export interface ISelect {
  getCenter(item: unknown): Point | null;
  putCenter(item: unknown, center: Point): void;

  moveOffset?(item: unknown, dx: number, dy: number): void;

  getScale?(item: unknown): Point | null;
  getRotation?(item: unknown): number | null;

  getSelectLevel?(item: unknown): number;

  flipX?(item: unknown, center: Point): void;
  flipY?(item: unknown, center: Point): void;
  rotate?(item: unknown, angle: number, center: Point, useElementCenter: boolean): void;
  scale?(item: unknown, scaleX: number, scaleY: number, center: Point, useElementCenter: boolean): void;
  translate?(item: unknown, offset: Point): void;

  addPoint?(item: unknown, x: number, y: number, smooth: boolean): void;
}

const selectRegistry = new Map<string, ISelect>();

export function registerSelect(type: string, select: ISelect): void {
  selectRegistry.set(type, select);
}

export function getSelect(type: string): ISelect | undefined {
  return selectRegistry.get(type);
}

export function hasSelect(type: string): boolean {
  return selectRegistry.has(type);
}

export function flipPoint(point: Point, center: Point, flipX: boolean, flipY: boolean): Point {
  return {
    x: flipX ? center.x - (point.x - center.x) : point.x,
    y: flipY ? center.y - (point.y - center.y) : point.y,
  };
}

export function rotatePoint(point: Point, center: Point, angleRad: number): Point {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: center.x + cos * dx - sin * dy,
    y: center.y + sin * dx + cos * dy,
  };
}

export function scalePoint(point: Point, center: Point, scaleX: number, scaleY: number): Point {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * scaleX,
    y: center.y + dy * scaleY,
  };
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}
