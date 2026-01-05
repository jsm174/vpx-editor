import type * as THREE from 'three';
import type { Point } from '../../types/game-objects.js';
import type { ISelect } from '../iselect.js';

export type { Point };
export type { ISelect };

export interface IEditable extends ISelect {
  render(item: unknown, isSelected: boolean): void;
  uiRenderPass1(item: unknown, isSelected: boolean): void;
  uiRenderPass2(item: unknown, isSelected: boolean): void;
  renderBlueprint(ctx: CanvasRenderingContext2D, item: unknown, scale: number, solid: boolean): void;
  hitTest?(item: unknown, worldX: number, worldY: number, center?: Point, distFromCenter?: number): boolean;
  create3DMesh?(item: unknown): THREE.Object3D | null;
  getProperties(item: unknown): string;
}

const editableRegistry = new Map<string, IEditable>();

export function registerEditable(type: string, editable: IEditable): void {
  editableRegistry.set(type, editable);
}

export function getEditable(type: string): IEditable | undefined {
  return editableRegistry.get(type);
}

export function hasEditable(type: string): boolean {
  return editableRegistry.has(type);
}

export function getAllTypes(): string[] {
  return Array.from(editableRegistry.keys());
}
