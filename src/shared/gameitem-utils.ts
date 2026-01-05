export function getItemNameFromFileName(fileName: string): string {
  return fileName
    .replace(/^\w+\./, '')
    .replace(/\.json$/, '')
    .replace(/___/g, ' - ')
    .replace(/_/g, ' ');
}

export function getFileNameFromItemName(type: string, name: string): string {
  const encodedName = name.replace(/ - /g, '___').replace(/ /g, '_');
  return `${type}.${encodedName}.json`;
}
