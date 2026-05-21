import { state, elements } from './state.js';
import { render, fitToView } from './canvas-renderer.js';
import { is3DInitialized, refresh3DScene, render3DFrameNow, get3DCanvas } from './canvas-renderer-3d.js';
import { updateZoomDisplay } from './utils.js';

interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface McpCaptureRequest {
  view?: '2d' | '3d';
  region?: CaptureRegion;
  maxWidth?: number;
}

function canvasToPngDataUrl(
  source: HTMLCanvasElement,
  maxWidth: number
): { dataUrl: string; width: number; height: number } {
  if (source.width <= maxWidth || source.width === 0) {
    return { dataUrl: source.toDataURL('image/png'), width: source.width, height: source.height };
  }
  const scale = maxWidth / source.width;
  const off = document.createElement('canvas');
  off.width = Math.round(source.width * scale);
  off.height = Math.round(source.height * scale);
  off.getContext('2d')!.drawImage(source, 0, 0, off.width, off.height);
  return { dataUrl: off.toDataURL('image/png'), width: off.width, height: off.height };
}

function capture2D(
  region: CaptureRegion | undefined,
  maxWidth: number
): { dataUrl: string; width: number; height: number } {
  const canvas = elements.canvas!;
  const saved = { zoom: state.zoom, panX: state.panX, panY: state.panY };
  try {
    if (region) {
      const zoom = Math.min(canvas.width / region.width, canvas.height / region.height);
      state.zoom = zoom;
      state.panX = (canvas.width - region.width * zoom) / 2 - region.x * zoom;
      state.panY = (canvas.height - region.height * zoom) / 2 - region.y * zoom;
      render();
    } else {
      fitToView();
    }
    return canvasToPngDataUrl(canvas, maxWidth);
  } finally {
    state.zoom = saved.zoom;
    state.panX = saved.panX;
    state.panY = saved.panY;
    updateZoomDisplay();
    render();
  }
}

function capture3D(maxWidth: number): { dataUrl: string; width: number; height: number } | null {
  if (!is3DInitialized()) return null;
  refresh3DScene();
  render3DFrameNow();
  const canvas = get3DCanvas();
  if (!canvas) return null;
  return canvasToPngDataUrl(canvas, maxWidth);
}

export async function waitForLoadComplete(timeoutMs = 30_000): Promise<void> {
  const overlay = document.getElementById('loading-overlay');
  const start = Date.now();
  while (overlay && !overlay.classList.contains('hidden') && Date.now() - start < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const graceDeadline = Date.now() + 5000;
  while (Object.keys(state.items).length === 0 && Date.now() < graceDeadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

export async function handleMcpCaptureRequest(raw: unknown): Promise<Record<string, unknown>> {
  const data = raw as McpCaptureRequest;
  try {
    if (!state.extractedDir) {
      return { success: false, error: 'No active table' };
    }
    await waitForLoadComplete();
    const maxWidth = data.maxWidth ?? 1024;
    if (data.view === '3d') {
      const result = capture3D(maxWidth);
      if (!result) {
        return {
          success: false,
          error:
            'The 3D view has not been opened yet in the editor. Capture the 2d view instead, or ask the user to open the 3D view once.',
        };
      }
      return { success: true, ...result };
    }
    return { success: true, ...capture2D(data.region, maxWidth) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
