import { elements } from './state.js';
import { is3DInitialized, get3DRenderer } from './canvas-renderer-3d.js';

export function setCanvasCursor(cursor: string): void {
  if (elements.canvas) {
    elements.canvas.style.cursor = cursor;
  }
  if (is3DInitialized()) {
    get3DRenderer().domElement.style.cursor = cursor;
  }
}
