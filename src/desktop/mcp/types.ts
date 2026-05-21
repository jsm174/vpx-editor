import type { z, ZodTypeAny } from 'zod';
import type { TableState } from '../../shared/table-state.js';
import type { ObjExchangeOptions } from '../../shared/obj-transform.js';

export interface ActiveTableHandle {
  workDir: string;
  vpxPath: string | null;
  tableName: string | null;
  windowId: string;
  isLocked: boolean;
}

export interface WindowSummary {
  windowId: string;
  tableName: string | null;
  vpxPath: string | null;
  isDirty: boolean;
  isLocked: boolean;
  attached: boolean;
}

export interface EditOperation {
  kind:
    | 'modify-part'
    | 'add-part'
    | 'delete-part'
    | 'edit-script'
    | 'replace-script-string'
    | 'replace-sub'
    | 'replace-script-range'
    | 'add-material'
    | 'modify-material'
    | 'add-image'
    | 'modify-image'
    | 'delete-image'
    | 'add-sound'
    | 'modify-sound'
    | 'delete-sound'
    | 'clone-bundle'
    | 'undo'
    | 'redo';
  payload: Record<string, unknown>;
  description: string;
  preview?: boolean;
}

export interface EditResult {
  success: boolean;
  applied: boolean;
  description?: string;
  preview?: Record<string, unknown>;
  error?: string;
  note?: string;
}

export interface VpxReader {
  extract(buffer: Uint8Array): Promise<Record<string, Uint8Array>>;
  objToMesh(
    data: Uint8Array
  ): Promise<{ positions: Float32Array; texCoords: Float32Array; normals: Float32Array; indices: Uint32Array }>;
}

export interface GeometryRequest {
  parts?: string[];
  region?: { x: number; y: number; width: number; height: number };
}

export interface MeshImportRequest {
  partName: string;
  filePath: string;
  unit: string;
  orientation: string;
  centerMesh: boolean;
  absolutePosition: boolean;
  importMaterial: boolean;
}

export interface MeshExportRequest {
  partName: string;
  mtlFileName: string;
  exchange?: ObjExchangeOptions;
}

export interface CaptureRequest {
  view: '2d' | '3d';
  region?: { x: number; y: number; width: number; height: number };
  maxWidth?: number;
}

export interface CaptureResult {
  ok: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface PlayTestResult {
  ok: boolean;
  ranSeconds: number;
  exitCode: number | null;
  timedOut: boolean;
  earlyExit: boolean;
  errorLines: string[];
  logTail: string;
  note?: string;
  error?: string;
}

export interface ToolContext {
  getActiveTable(): Promise<ActiveTableHandle | null>;
  loadActiveState(): Promise<TableState | null>;
  /** All open editor windows with a table. The session stays attached to one window at a time. */
  listWindows(): Promise<WindowSummary[]>;
  /** Re-attach this session to a specific editor window (see listWindows). */
  attachWindow(windowId: string): Promise<{ ok: boolean; error?: string; handle?: ActiveTableHandle }>;
  /** Load a donor .vpx from an absolute path on demand (no corpus index). */
  loadTable(vpxPath: string): Promise<TableState | null>;
  /** Create a new table from a bundled template and open it in an editor window. */
  createTable(
    templateName: string,
    displayName: string
  ): Promise<{ ok: true; workDir: string; tableName: string | null } | { ok: false; error: string }>;
  applyEdit(edit: EditOperation): Promise<EditResult>;
  /** Save the active table via the editor's normal save flow (may open a native Save As dialog). */
  saveTable(): Promise<{ saved: boolean; path: string | null; error?: string }>;
  /** Capture a PNG screenshot of the editor's 2D (top-down) or 3D view of the active table. */
  captureView(req: CaptureRequest): Promise<CaptureResult>;
  /** World-space mesh summaries (bbox, centroid, shape scores) for parts on the active table. */
  queryGeometry(req: GeometryRequest): Promise<Record<string, unknown>>;
  /** Render the active table's visible geometry to OBJ+MTL text. */
  exportObj(mtlFileName: string, exchange?: ObjExchangeOptions): Promise<Record<string, unknown>>;
  /** Replace a Primitive's mesh with an external OBJ (units/orientation converted on the way in). */
  importPrimitiveMesh(
    req: MeshImportRequest
  ): Promise<
    { ok: true; path: string; materialName?: string; primitive: Record<string, unknown> } | { ok: false; error: string }
  >;
  /** One Primitive's mesh as OBJ (+MTL when it has a material), in the requested units/orientation. */
  exportPrimitiveMesh(
    req: MeshExportRequest
  ): Promise<{ ok: true; obj: string; mtl: string | null } | { ok: false; error: string }>;
  /** Assemble the active table and boot it in VPinballX for a few seconds, collecting script errors. */
  playTest(opts: { seconds: number }): Promise<PlayTestResult>;
  vpx: VpxReader;
  /** Session-scoped log: goes to the console of the window this session is attached to. */
  log: (msg: string) => void;
  config: { mcpPort: number; systemScriptsPath: string | null; glfPath: string | null; templatesPath: string | null };
}

export interface ToolContentText {
  type: 'text';
  text: string;
}

export interface ToolContentImage {
  type: 'image';
  data: string;
  mimeType: string;
}

export type ToolContent = ToolContentText | ToolContentImage;

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface Tool<I extends ZodTypeAny = ZodTypeAny> {
  name: string;
  title?: string;
  description: string;
  inputSchema: I;
  outputSchema?: ZodTypeAny;
  annotations?: ToolAnnotations;
  execute: (input: z.infer<I>, ctx: ToolContext) => Promise<ToolResult>;
}

export function jsonResult(value: unknown): ToolResult {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return {
    content: [{ type: 'text', text }],
    structuredContent: typeof value === 'object' && value ? (value as Record<string, unknown>) : undefined,
  };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function imageResult(pngBase64: string, caption?: string): ToolResult {
  const content: ToolContent[] = [{ type: 'image', data: pngBase64, mimeType: 'image/png' }];
  if (caption) content.unshift({ type: 'text', text: caption });
  return { content };
}
