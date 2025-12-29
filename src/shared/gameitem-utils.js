export function getItemNameFromFileName(fileName) {
  return fileName.replace(/^\w+\./, '').replace(/\.json$/, '');
}
