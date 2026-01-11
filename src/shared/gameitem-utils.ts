export function encodeNameForFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

export function extractEncodedNameFromFileName(fileName: string): string {
  return fileName.replace(/^\w+\./, '').replace(/\.json$/, '');
}

export function generateUniqueFileName(type: string, name: string, existingFileNames: string[]): string {
  const encoded = encodeNameForFileName(name);
  const baseName = `${type}.${encoded}`;
  let fileName = `${baseName}.json`;

  const existingLower = new Set(existingFileNames.map(f => f.toLowerCase()));
  if (!existingLower.has(fileName.toLowerCase())) {
    return fileName;
  }

  let counter = 1;
  while (existingLower.has(`${baseName}__${counter}.json`.toLowerCase())) {
    counter++;
  }
  return `${baseName}__${counter}.json`;
}

export function nameEquals(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function includesName(arr: string[], name: string): boolean {
  const lower = name.toLowerCase();
  return arr.some(item => item.toLowerCase() === lower);
}

export function findIndexByName(arr: string[], name: string): number {
  const lower = name.toLowerCase();
  return arr.findIndex(item => item.toLowerCase() === lower);
}

export function findByName<T extends { name?: string }>(arr: T[], name: string): T | undefined {
  const lower = name.toLowerCase();
  return arr.find(item => item.name?.toLowerCase() === lower);
}

export function findIndexByNameProp<T extends { name?: string }>(arr: T[], name: string): number {
  const lower = name.toLowerCase();
  return arr.findIndex(item => item.name?.toLowerCase() === lower);
}
