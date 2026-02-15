import fs from 'fs-extra';
import {
  runAllUpgrades as sharedRunAllUpgrades,
  upgradeOldMaterialsFormat as sharedUpgradeOldMaterialsFormat,
  upgradePlayfieldMeshVisibility as sharedUpgradePlayfieldMeshVisibility,
  upgradeLayersToPartGroups as sharedUpgradeLayersToPartGroups,
  upgradePartGroupIsLocked as sharedUpgradePartGroupIsLocked,
  upgradePartGroupOrdering as sharedUpgradePartGroupOrdering,
  cleanupCollectionItems as sharedCleanupCollectionItems,
  type FileSystemAdapter,
  type ConsoleOutputCallback,
} from '../shared/table-upgrades';

const nodeFileSystem: FileSystemAdapter = {
  exists: (path: string) => Promise.resolve(fs.existsSync(path)),
  readFile: (path: string) => fs.promises.readFile(path, 'utf-8'),
  writeFile: (path: string, content: string) => fs.promises.writeFile(path, content),
  deleteFile: (path: string) => fs.promises.unlink(path),
  listDir: (path: string) => fs.promises.readdir(path),
};

export async function upgradeOldMaterialsFormat(dir: string): Promise<boolean> {
  return sharedUpgradeOldMaterialsFormat(nodeFileSystem, dir);
}

export async function upgradePlayfieldMeshVisibility(
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<void> {
  return sharedUpgradePlayfieldMeshVisibility(nodeFileSystem, dir, sendConsoleOutput);
}

export async function upgradeLayersToPartGroups(
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<boolean> {
  return sharedUpgradeLayersToPartGroups(nodeFileSystem, dir, sendConsoleOutput);
}

export async function upgradePartGroupIsLocked(
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<boolean> {
  return sharedUpgradePartGroupIsLocked(nodeFileSystem, dir, sendConsoleOutput);
}

export async function upgradePartGroupOrdering(
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<boolean> {
  return sharedUpgradePartGroupOrdering(nodeFileSystem, dir, sendConsoleOutput);
}

export async function cleanupCollectionItems(dir: string, sendConsoleOutput?: ConsoleOutputCallback): Promise<boolean> {
  return sharedCleanupCollectionItems(nodeFileSystem, dir, sendConsoleOutput);
}

export async function runAllUpgrades(dir: string, sendConsoleOutput?: ConsoleOutputCallback): Promise<void> {
  return sharedRunAllUpgrades(nodeFileSystem, dir, sendConsoleOutput);
}
