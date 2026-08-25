import { state } from './state.js';
import { appendConsoleLine } from './console-panel.js';
import {
  exportTableObjOptions,
  insertObjHeaderComment,
  renameObjMtlReference,
  type ObjExchangeOptions,
} from '../shared/obj-transform.js';
import { DEFAULT_OBJ_ORIENTATION, DEFAULT_OBJ_UNIT } from '../shared/constants.js';

const DEFAULT_EXCHANGE: ObjExchangeOptions = {
  unit: DEFAULT_OBJ_UNIT,
  orientation: DEFAULT_OBJ_ORIENTATION,
};

function downloadFile(content: string | Uint8Array, fileName: string): void {
  const blob =
    typeof content === 'string'
      ? new Blob([content], { type: 'text/plain' })
      : new Blob([new Uint8Array(content).buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
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

export async function exportTableMeshAndSave(options: ObjExchangeOptions = DEFAULT_EXCHANGE): Promise<string | null> {
  const tableName = state.tableName || 'table';
  const isDesktop = !!(window.vpxEditor?.exportObjMeshGetPath && window.vpxEditor?.exportObjTable);

  let objPath: string | null = null;
  if (isDesktop) {
    objPath = await window.vpxEditor.exportObjMeshGetPath!(`${tableName}.obj`);
    if (!objPath) return null;
  }

  let files: Record<string, Uint8Array> | null;
  if (isDesktop) {
    const result = await window.vpxEditor.exportObjTable!(exportTableObjOptions(options));
    if (!result?.success || !result.files) {
      console.warn('OBJ export failed:', result?.error);
      return null;
    }
    files = result.files;
  } else {
    const { exportObjTableFiles } = await import('../web/vpx-file-operations.js');
    files = await exportObjTableFiles(exportTableObjOptions(options));
  }

  const objBytes = files?.['table.obj'];
  const mtlBytes = files?.['table.mtl'];
  if (!objBytes || !mtlBytes) return null;

  if (isDesktop && objPath) {
    const separator = objPath.includes('\\') ? '\\' : '/';
    const objFileName = objPath.split(separator).pop()!;
    const mtlFileName = objFileName.replace(/\.obj$/i, '') + '.mtl';
    const mtlPath = objPath.slice(0, objPath.length - objFileName.length) + mtlFileName;
    await window.vpxEditor.writeFile(objPath, finishObjText(objBytes, mtlFileName, options));
    await window.vpxEditor.writeFile(mtlPath, new TextDecoder().decode(mtlBytes));
    appendConsoleLine(`Exported ${objPath}`, 'success');
    return objPath;
  }

  const objFileName = `${tableName}.obj`;
  const mtlFileName = `${tableName}.mtl`;
  downloadFile(finishObjText(objBytes, mtlFileName, options), objFileName);
  downloadFile(mtlBytes, mtlFileName);
  appendConsoleLine(`Exported ${objFileName} and ${mtlFileName}`, 'success');
  return objFileName;
}
