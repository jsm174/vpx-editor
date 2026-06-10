let overlay: HTMLDivElement | null = null;
let textEl: HTMLSpanElement | null = null;
let barFillEl: HTMLDivElement | null = null;
let visible = false;
let updateScheduled = false;

interface LoadJob {
  kind: 'textures' | 'meshes';
  weight: number;
}

let nextJobId = 0;
const jobs = new Map<number, LoadJob>();
let doneWeight = 0;
let totalWeight = 0;

export function initLoadingIndicator(container: HTMLElement): void {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'loading-indicator-3d';
  overlay.style.display = 'none';

  const row = document.createElement('div');
  row.className = 'loading-indicator-3d-row';
  const spinner = document.createElement('div');
  spinner.className = 'loading-indicator-3d-spinner';
  textEl = document.createElement('span');
  row.appendChild(spinner);
  row.appendChild(textEl);

  const track = document.createElement('div');
  track.className = 'loading-indicator-3d-track';
  barFillEl = document.createElement('div');
  barFillEl.className = 'loading-indicator-3d-fill';
  track.appendChild(barFillEl);

  overlay.appendChild(row);
  overlay.appendChild(track);
  container.appendChild(overlay);
}

export function setLoadingIndicatorVisible(allowed: boolean): void {
  visible = allowed;
  scheduleUpdate();
}

export function loadingStarted(kind: 'textures' | 'meshes', weight: number): number {
  const id = nextJobId++;
  jobs.set(id, { kind, weight });
  totalWeight += weight;
  scheduleUpdate();
  return id;
}

export function loadingFinished(id: number): void {
  const job = jobs.get(id);
  if (!job) return;
  jobs.delete(id);
  doneWeight += job.weight;
  scheduleUpdate();
}

function scheduleUpdate(): void {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(() => {
    updateScheduled = false;
    update();
  });
}

function update(): void {
  if (!overlay || !textEl || !barFillEl) return;

  if (jobs.size === 0) {
    doneWeight = 0;
    totalWeight = 0;
    overlay.style.display = 'none';
    return;
  }

  if (!visible) {
    overlay.style.display = 'none';
    return;
  }

  let meshCount = 0;
  let textureCount = 0;
  for (const job of jobs.values()) {
    if (job.kind === 'meshes') meshCount++;
    else textureCount++;
  }

  const parts: string[] = [];
  if (meshCount > 0) parts.push(`${meshCount} ${meshCount === 1 ? 'mesh' : 'meshes'}`);
  if (textureCount > 0) parts.push(`${textureCount} ${textureCount === 1 ? 'texture' : 'textures'}`);

  const percent = totalWeight > 0 ? (doneWeight / totalWeight) * 100 : 0;

  overlay.style.display = 'flex';
  textEl.textContent = `Loading ${parts.join(', ')}…`;
  barFillEl.style.width = `${percent.toFixed(1)}%`;
}
