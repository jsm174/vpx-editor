import { hasObjectDragPoints } from '../editor/object-types.js';
import type { Point, DragPoint } from '../types/game-objects.js';
import { getDragPointCoords, translateDragPoint } from '../types/game-objects.js';

export type { Point };

export interface PositionableItem {
  _type?: string;
  center?: Point;
  vCenter?: Point;
  pos?: Point;
  position?: Point;
  pos_x?: number;
  pos_y?: number;
  ver1?: Point;
  ver2?: Point;
  drag_points?: DragPoint[];
}

export function getItemCenter(item: PositionableItem): Point | null {
  if (item.center) return { x: item.center.x, y: item.center.y };
  if (item.vCenter) return { x: item.vCenter.x, y: item.vCenter.y };
  if (item.pos) return { x: item.pos.x, y: item.pos.y };
  if (item.position) return { x: item.position.x, y: item.position.y };
  if (item.drag_points && item.drag_points.length > 0) {
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    for (const pt of item.drag_points) {
      const { x: px, y: py } = getDragPointCoords(pt);
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }
  if (item.pos_x !== undefined && item.pos_y !== undefined) {
    return { x: item.pos_x, y: item.pos_y };
  }
  if (item.ver1 && item.ver2) {
    return { x: (item.ver1.x + item.ver2.x) / 2, y: (item.ver1.y + item.ver2.y) / 2 };
  }
  return null;
}

export function setItemPosition(
  item: PositionableItem,
  x: number,
  y: number,
  originalCenter: Point,
  type: string | null = null
): void {
  const dx = x - originalCenter.x;
  const dy = y - originalCenter.y;

  if (item.center) {
    item.center.x += dx;
    item.center.y += dy;
  } else if (item.position) {
    item.position.x += dx;
    item.position.y += dy;
  } else if (item.pos) {
    item.pos.x += dx;
    item.pos.y += dy;
  } else if (item.pos_x !== undefined && item.pos_y !== undefined) {
    item.pos_x += dx;
    item.pos_y += dy;
  } else if (item.ver1 && item.ver2) {
    item.ver1.x += dx;
    item.ver1.y += dy;
    item.ver2.x += dx;
    item.ver2.y += dy;
  }

  const itemType = type || item._type;
  if (itemType && hasObjectDragPoints(itemType) && item.drag_points) {
    for (const pt of item.drag_points) {
      translateDragPoint(pt, dx, dy);
    }
  }
}

export function translateItem(item: PositionableItem, dx: number, dy: number): void {
  if (item.center) {
    item.center.x += dx;
    item.center.y += dy;
  } else if (item.position) {
    item.position.x += dx;
    item.position.y += dy;
  } else if (item.pos) {
    item.pos.x += dx;
    item.pos.y += dy;
  } else if (item.pos_x !== undefined && item.pos_y !== undefined) {
    item.pos_x += dx;
    item.pos_y += dy;
  } else if (item.ver1 && item.ver2) {
    item.ver1.x += dx;
    item.ver1.y += dy;
    item.ver2.x += dx;
    item.ver2.y += dy;
  }

  if (item._type && hasObjectDragPoints(item._type) && item.drag_points) {
    for (const pt of item.drag_points) {
      translateDragPoint(pt, dx, dy);
    }
  }
}
