import { state, elements, getItem } from './state.js';
import { appendConsoleLine } from './console-panel.js';
import {
  exportTableGlbOptions,
  exportTableObjOptions,
  insertObjHeaderComment,
  renameObjMtlReference,
  type ObjExchangeOptions,
  type TableExportFilter,
} from '../shared/obj-transform.js';
import { DEFAULT_OBJ_ORIENTATION, DEFAULT_OBJ_UNIT } from '../shared/constants.js';
import type { MeshExportKind, MeshExportOptions } from '../features/mesh-export/shared/component.js';

export type TableObjExchange = ObjExchangeOptions & Partial<TableExportFilter>;

const DEFAULT_EXCHANGE: ObjExchangeOptions = {
  unit: DEFAULT_OBJ_UNIT,
  orientation: DEFAULT_OBJ_ORIENTATION,
};

export function promptTableExportOptions(kind: MeshExportKind): Promise<MeshExportOptions | null> {
  const selected = state.selectedItems.filter(name => !!getItem(name));
  return window.vpxEditor.promptMeshExportOptions(kind, selected);
}

function setStatus(text: string): void {
  if (elements.statusBar) elements.statusBar.textContent = text;
}

export async function promptAndExportTableObj(): Promise<void> {
  const options = await promptTableExportOptions('obj');
  if (!options) {
    setStatus('OBJ export cancelled');
    return;
  }
  setStatus('Exporting OBJ mesh...');
  const objPath = await exportTableMeshAndSave(options);
  setStatus(objPath ? `Exported mesh: ${objPath}` : 'OBJ export cancelled');
}

export async function promptAndExportTableGlb(): Promise<void> {
  const options = await promptTableExportOptions('glb');
  if (!options) {
    setStatus('GLB export cancelled');
    return;
  }
  setStatus('Exporting GLB...');
  const glbOptions = exportTableGlbOptions(options);
  if (window.vpxEditor?.exportGlbTable) {
    const result = await window.vpxEditor.exportGlbTable(glbOptions);
    if (result.success) setStatus(`Exported GLB: ${result.path}`);
    else if (result.cancelled) setStatus('GLB export cancelled');
    else setStatus(`GLB export failed: ${result.error}`);
    return;
  }
  const { handleExportGlb } = await import('../web/vpx-file-operations.js');
  await handleExportGlb(glbOptions);
  setStatus('Exported GLB');
}

function downloadFile(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function finishObjText(objBytes: Uint8Array, mtlFileName: string, options: ObjExchangeOptions): string {
  return insertObjHeaderComment(renameObjMtlReference(new TextDecoder().decode(objBytes), mtlFileName), options);
}

async function exportTableMeshFiles(options: TableObjExchange): Promise<Record<string, Uint8Array> | null> {
  if (window.vpxEditor?.exportObjTable) {
    const result = await window.vpxEditor.exportObjTable(exportTableObjOptions(options));
    if (!result?.success || !result.files) {
      console.warn('OBJ export failed:', result?.error);
      return null;
    }
    return result.files;
  }
  const { exportObjTableFiles } = await import('../web/vpx-file-operations.js');
  return exportObjTableFiles(exportTableObjOptions(options));
}

export async function exportTableMesh(
  mtlFileName: string,
  options: TableObjExchange = DEFAULT_EXCHANGE
): Promise<{ obj: string; mtl: string } | null> {
  const files = await exportTableMeshFiles(options);
  const objBytes = files?.['table.obj'];
  const mtlBytes = files?.['table.mtl'];
  if (!objBytes || !mtlBytes) return null;
  return { obj: finishObjText(objBytes, mtlFileName, options), mtl: new TextDecoder().decode(mtlBytes) };
}

export async function exportTableMeshAndSave(options: TableObjExchange = DEFAULT_EXCHANGE): Promise<string | null> {
  const tableName = state.tableName || 'table';
  const isDesktop = !!(window.vpxEditor?.exportObjMeshGetPath && window.vpxEditor?.exportObjTable);

  if (isDesktop) {
    const objPath = await window.vpxEditor.exportObjMeshGetPath!(`${tableName}.obj`);
    if (!objPath) return null;

    const separator = objPath.includes('\\') ? '\\' : '/';
    const objFileName = objPath.split(separator).pop()!;
    const mtlFileName = objFileName.replace(/\.obj$/i, '') + '.mtl';
    const mtlPath = objPath.slice(0, objPath.length - objFileName.length) + mtlFileName;

    const result = await exportTableMesh(mtlFileName, options);
    if (!result) return null;
    await window.vpxEditor.writeFile(objPath, result.obj);
    await window.vpxEditor.writeFile(mtlPath, result.mtl);
    appendConsoleLine(`Exported ${objPath}`, 'success');
    return objPath;
  }

  const objFileName = `${tableName}.obj`;
  const mtlFileName = `${tableName}.mtl`;
  const result = await exportTableMesh(mtlFileName, options);
  if (!result) return null;
  downloadFile(result.obj, objFileName);
  downloadFile(result.mtl, mtlFileName);
  appendConsoleLine(`Exported ${objFileName} and ${mtlFileName}`, 'success');
  return objFileName;
}
