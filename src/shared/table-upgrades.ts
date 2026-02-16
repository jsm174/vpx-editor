import type { GameItemMeta } from '../types/game-objects.js';
import { generateUniqueFileName, extractEncodedNameFromFileName } from './gameitem-utils.js';

interface OldMaterial {
  name: string;
  is_metal: boolean;
  base_color: string;
  glossy_color: string;
  clearcoat_color: string;
  wrap_lighting: number;
  roughness: number;
  glossy_image_lerp: number;
  thickness: number;
  edge: number;
  opacity_active_edge_alpha: number;
  opacity: number;
}

interface OldPhysics {
  name: string;
  elasticity?: number;
  elasticity_falloff?: number;
  friction?: number;
  scatter_angle?: number;
}

interface NewMaterial {
  name: string;
  type: string;
  base_color: string;
  glossy_color: string;
  clearcoat_color: string;
  wrap_lighting: number;
  roughness: number;
  glossy_image_lerp: number;
  thickness: number;
  edge: number;
  edge_alpha: number;
  opacity: number;
  opacity_active: boolean;
  refraction_tint: string;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter_angle: number;
}

type GameItemInfo = GameItemMeta;

interface Collection {
  name: string;
  items: string[];
}

export type ConsoleOutputCallback = (type: string, text: string) => void;

export interface FileSystemAdapter {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listDir(path: string): Promise<string[]>;
}

function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

function convertOldToNewMaterials(oldMaterials: OldMaterial[], oldPhysics: OldPhysics[]): NewMaterial[] {
  const physicsMap: Record<string, OldPhysics> = {};
  for (const phys of oldPhysics) {
    physicsMap[phys.name] = phys;
  }

  return oldMaterials.map(oldMat => {
    const phys = physicsMap[oldMat.name] || {};

    const glossy_image_lerp = 1.0 - oldMat.glossy_image_lerp / 255.0;
    const thickness = oldMat.thickness === 0 ? 0.05 : oldMat.thickness / 255.0;
    const edge_alpha = ((oldMat.opacity_active_edge_alpha >> 1) & 0x7f) / 127.0;
    const opacity_active = (oldMat.opacity_active_edge_alpha & 1) === 1;

    return {
      name: oldMat.name,
      type: oldMat.is_metal ? 'metal' : 'basic',
      base_color: oldMat.base_color,
      glossy_color: oldMat.glossy_color,
      clearcoat_color: oldMat.clearcoat_color,
      wrap_lighting: oldMat.wrap_lighting,
      roughness: oldMat.roughness,
      glossy_image_lerp,
      thickness,
      edge: oldMat.edge,
      edge_alpha,
      opacity: oldMat.opacity,
      opacity_active,
      refraction_tint: '#ffffff',
      elasticity: phys.elasticity ?? 0.3,
      elasticity_falloff: phys.elasticity_falloff ?? 0.0,
      friction: phys.friction ?? 0.3,
      scatter_angle: phys.scatter_angle ?? 0.0,
    };
  });
}

export async function upgradePlayfieldMeshVisibility(
  fs: FileSystemAdapter,
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<void> {
  const playfieldPath = joinPath(dir, 'gameitems', 'Primitive.playfield_mesh.json');

  if (await fs.exists(playfieldPath)) {
    try {
      const content = JSON.parse(await fs.readFile(playfieldPath));
      if (content.Primitive && content.Primitive.is_visible === false) {
        content.Primitive.is_visible = true;
        await fs.writeFile(playfieldPath, JSON.stringify(content, null, 2));
        if (sendConsoleOutput) {
          sendConsoleOutput('info', 'Fixed playfield_mesh visibility (pre-10.8 table workaround)');
        }
      }
    } catch (err) {
      if (sendConsoleOutput) {
        sendConsoleOutput('error', `Failed to upgrade playfield_mesh: ${(err as Error).message}`);
      }
    }
  }
}

export async function upgradeOldMaterialsFormat(fs: FileSystemAdapter, dir: string): Promise<boolean> {
  const oldMatPath = joinPath(dir, 'materials-old.json');
  const oldPhysPath = joinPath(dir, 'materials-physics-old.json');
  const newMatPath = joinPath(dir, 'materials.json');
  const versionPath = joinPath(dir, 'version.txt');

  if ((await fs.exists(oldMatPath)) && !(await fs.exists(newMatPath))) {
    const oldMaterials: OldMaterial[] = JSON.parse(await fs.readFile(oldMatPath));
    const oldPhysics: OldPhysics[] = (await fs.exists(oldPhysPath)) ? JSON.parse(await fs.readFile(oldPhysPath)) : [];

    const newMaterials = convertOldToNewMaterials(oldMaterials, oldPhysics);

    await fs.writeFile(newMatPath, JSON.stringify(newMaterials, null, 2));

    await fs.deleteFile(oldMatPath);
    if (await fs.exists(oldPhysPath)) {
      await fs.deleteFile(oldPhysPath);
    }

    await fs.writeFile(versionPath, '1081');
    return true;
  }
  return false;
}

function sanitizeLayerName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

function getInitialPartGroupName(itemInfo: GameItemInfo): string {
  const layerIndex = itemInfo.editor_layer ?? 0;
  const layerName = itemInfo.editor_layer_name;

  if (!layerName) {
    return layerIndex < 9 ? `Layer_0${layerIndex + 1}` : `Layer_${layerIndex + 1}`;
  }

  const sanitized = sanitizeLayerName(layerName);
  return `Layer_${sanitized}`;
}

function isPurelyNumeric(str: string): boolean {
  return /^[0-9]+$/.test(str);
}

export async function upgradeLayersToPartGroups(
  fs: FileSystemAdapter,
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<boolean> {
  const gameitemsPath = joinPath(dir, 'gameitems.json');
  const gameitemsDir = joinPath(dir, 'gameitems');

  if (!(await fs.exists(gameitemsPath))) return false;

  const gameitems: GameItemInfo[] = JSON.parse(await fs.readFile(gameitemsPath));

  const hasPartGroups = gameitems.some(item => item.file_name.startsWith('PartGroup.'));
  if (hasPartGroups) return false;

  const layers = new Map<string, { items: GameItemInfo[] }>();
  const allItemNames = new Set<string>();

  for (const itemInfo of gameitems) {
    const initialGroupName = getInitialPartGroupName(itemInfo);

    if (!layers.has(initialGroupName)) {
      layers.set(initialGroupName, { items: [] });
    }
    layers.get(initialGroupName)!.items.push(itemInfo);

    const itemBaseName = extractEncodedNameFromFileName(itemInfo.file_name);
    allItemNames.add(itemBaseName.toLowerCase());
  }

  let script = '';
  const scriptPath = joinPath(dir, 'script.vbs');
  if (await fs.exists(scriptPath)) {
    script = (await fs.readFile(scriptPath)).toLowerCase();
  }

  const groupNameRemap = new Map<string, string>();
  const finalGroupNames = new Set<string>();

  for (const groupName of layers.keys()) {
    if (groupName.startsWith('Layer_')) {
      const shortName = groupName.substring(6);
      const shortNameLower = shortName.toLowerCase();

      const conflictsWithItem = allItemNames.has(shortNameLower);
      const conflictsWithGroup = finalGroupNames.has(shortNameLower);
      const usedInScript = !isPurelyNumeric(shortName) && script.includes(shortNameLower);

      if (!conflictsWithItem && !conflictsWithGroup && !usedInScript) {
        groupNameRemap.set(groupName, shortName);
        finalGroupNames.add(shortNameLower);
      } else {
        groupNameRemap.set(groupName, groupName);
        finalGroupNames.add(groupName.toLowerCase());
      }
    } else {
      groupNameRemap.set(groupName, groupName);
      finalGroupNames.add(groupName.toLowerCase());
    }
  }

  const partGroupEntries: GameItemInfo[] = [];
  const existingFileNames = gameitems.map(gi => gi.file_name);

  for (const [initialGroupName, layerData] of layers) {
    const groupName = groupNameRemap.get(initialGroupName)!;

    const partGroup = {
      PartGroup: {
        name: groupName,
        center: { x: 0.0, y: 0.0 },
        is_timer_enabled: false,
        timer_interval: 100,
        backglass: false,
        space_reference: 'playfield',
        player_mode_visibility_mask: 65535,
        is_locked: false,
        editor_layer_visibility: true,
      },
    };

    const partGroupFileName = generateUniqueFileName('PartGroup', groupName, existingFileNames);
    existingFileNames.push(partGroupFileName);
    const partGroupPath = joinPath(gameitemsDir, partGroupFileName);
    await fs.writeFile(partGroupPath, JSON.stringify(partGroup, null, 2));

    partGroupEntries.push({
      file_name: partGroupFileName,
      is_locked: false,
      editor_layer: 0,
      editor_layer_name: '',
      editor_layer_visibility: true,
    });

    for (const itemInfo of layerData.items) {
      const itemPath = joinPath(gameitemsDir, itemInfo.file_name);
      if (await fs.exists(itemPath)) {
        const itemContent = JSON.parse(await fs.readFile(itemPath));
        const type = Object.keys(itemContent)[0];
        if (itemContent[type]) {
          itemContent[type].part_group_name = groupName;
          await fs.writeFile(itemPath, JSON.stringify(itemContent, null, 2));
        }
      }
    }
  }

  const newGameitems = [...partGroupEntries, ...gameitems];
  await fs.writeFile(gameitemsPath, JSON.stringify(newGameitems, null, 2));

  const groupNames = [...groupNameRemap.values()].join(', ');
  if (sendConsoleOutput) {
    sendConsoleOutput('info', `Upgraded ${layers.size} legacy layers to PartGroups: ${groupNames}`);
  }

  return true;
}

export async function upgradePartGroupIsLocked(
  fs: FileSystemAdapter,
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<boolean> {
  const gameitemsDir = joinPath(dir, 'gameitems');
  if (!(await fs.exists(gameitemsDir))) return false;

  const files = await fs.listDir(gameitemsDir);
  const partGroupFiles = files.filter(f => f.startsWith('PartGroup.') && f.endsWith('.json'));

  let upgraded = 0;
  for (const file of partGroupFiles) {
    const filePath = joinPath(gameitemsDir, file);
    try {
      const content = JSON.parse(await fs.readFile(filePath));
      if (content.PartGroup && content.PartGroup.is_locked === undefined) {
        content.PartGroup.is_locked = false;
        await fs.writeFile(filePath, JSON.stringify(content, null, 2));
        upgraded++;
      }
    } catch (err) {
      if (sendConsoleOutput) {
        sendConsoleOutput('error', `Failed to upgrade ${file}: ${(err as Error).message}`);
      }
    }
  }

  if (upgraded > 0 && sendConsoleOutput) {
    sendConsoleOutput('info', `Added missing is_locked field to ${upgraded} PartGroup file(s)`);
  }

  return upgraded > 0;
}

export async function upgradePartGroupOrdering(
  fs: FileSystemAdapter,
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<boolean> {
  const gameitemsPath = joinPath(dir, 'gameitems.json');
  if (!(await fs.exists(gameitemsPath))) return false;

  const gameitems: GameItemInfo[] = JSON.parse(await fs.readFile(gameitemsPath));

  const firstNonGroup = gameitems.findIndex(gi => !gi.file_name.startsWith('PartGroup.'));
  const hasGroupAfterNonGroup = gameitems.some((gi, i) => i > firstNonGroup && gi.file_name.startsWith('PartGroup.'));

  if (firstNonGroup < 0 || !hasGroupAfterNonGroup) return false;

  const groups = gameitems.filter(gi => gi.file_name.startsWith('PartGroup.'));
  const others = gameitems.filter(gi => !gi.file_name.startsWith('PartGroup.'));
  const reordered = [...groups, ...others];

  await fs.writeFile(gameitemsPath, JSON.stringify(reordered, null, 2));
  sendConsoleOutput?.('info', `Reordered ${groups.length} PartGroup(s) to appear before other game items`);
  return true;
}

export async function cleanupCollectionItems(
  fs: FileSystemAdapter,
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<boolean> {
  const collectionsPath = joinPath(dir, 'collections.json');
  const gameitemsPath = joinPath(dir, 'gameitems.json');

  if (!(await fs.exists(collectionsPath)) || !(await fs.exists(gameitemsPath))) {
    return false;
  }

  const collections: Collection[] = JSON.parse(await fs.readFile(collectionsPath));
  const gameitems: GameItemInfo[] = JSON.parse(await fs.readFile(gameitemsPath));

  const validEncodedNames = new Set<string>();
  for (const item of gameitems) {
    const rawName = item.file_name.replace(/^\w+\./, '').replace(/\.json$/, '');
    validEncodedNames.add(rawName.toLowerCase());
  }

  const encodeItemName = (name: string): string => name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

  let modified = false;
  const removedItems: { collection: string; item: string }[] = [];

  for (const collection of collections) {
    const originalCount = collection.items.length;
    const validItems = collection.items.filter(itemName => {
      const encodedName = encodeItemName(itemName);
      if (validEncodedNames.has(encodedName)) {
        return true;
      }
      removedItems.push({ collection: collection.name, item: itemName });
      return false;
    });

    if (validItems.length !== originalCount) {
      collection.items = validItems;
      modified = true;
    }
  }

  if (modified) {
    await fs.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
    if (sendConsoleOutput) {
      for (const { collection, item } of removedItems) {
        sendConsoleOutput('warn', `Removed missing item "${item}" from collection "${collection}"`);
      }
    }
  }

  return modified;
}

export async function upgradeTypeFieldRename(
  fs: FileSystemAdapter,
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<boolean> {
  let upgraded = false;

  const materialsPath = joinPath(dir, 'materials.json');
  if (await fs.exists(materialsPath)) {
    try {
      const materials = JSON.parse(await fs.readFile(materialsPath)) as Record<string, unknown>[];
      let modified = false;
      for (const mat of materials) {
        if ('type_' in mat && !('type' in mat)) {
          mat.type = mat.type_;
          delete mat.type_;
          modified = true;
        }
      }
      if (modified) {
        await fs.writeFile(materialsPath, JSON.stringify(materials, null, 2));
        upgraded = true;
        sendConsoleOutput?.('info', 'Upgraded materials.json: renamed type_ to type');
      }
    } catch (err) {
      sendConsoleOutput?.('error', `Failed to upgrade materials type field: ${(err as Error).message}`);
    }
  }

  const renderprobesPath = joinPath(dir, 'renderprobes.json');
  if (await fs.exists(renderprobesPath)) {
    try {
      const probes = JSON.parse(await fs.readFile(renderprobesPath)) as Record<string, unknown>[];
      let modified = false;
      for (const probe of probes) {
        if ('type_' in probe && !('type' in probe)) {
          probe.type = probe.type_;
          delete probe.type_;
          modified = true;
        }
      }
      if (modified) {
        await fs.writeFile(renderprobesPath, JSON.stringify(probes, null, 2));
        upgraded = true;
        sendConsoleOutput?.('info', 'Upgraded renderprobes.json: renamed type_ to type');
      }
    } catch (err) {
      sendConsoleOutput?.('error', `Failed to upgrade renderprobes type field: ${(err as Error).message}`);
    }
  }

  return upgraded;
}

export async function runAllUpgrades(
  fs: FileSystemAdapter,
  dir: string,
  sendConsoleOutput?: ConsoleOutputCallback
): Promise<void> {
  await upgradeOldMaterialsFormat(fs, dir);
  await upgradeTypeFieldRename(fs, dir, sendConsoleOutput);
  await upgradePlayfieldMeshVisibility(fs, dir, sendConsoleOutput);
  await upgradeLayersToPartGroups(fs, dir, sendConsoleOutput);
  await upgradePartGroupIsLocked(fs, dir, sendConsoleOutput);
  await upgradePartGroupOrdering(fs, dir, sendConsoleOutput);
  await cleanupCollectionItems(fs, dir, sendConsoleOutput);
}
