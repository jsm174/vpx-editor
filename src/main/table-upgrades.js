import fs from 'fs-extra';
import path from 'node:path';

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function convertOldToNewMaterials(oldMaterials, oldPhysics) {
  const physicsMap = {};
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
      type_: oldMat.is_metal ? 'Metal' : 'Basic',
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

export async function upgradePlayfieldMeshVisibility(dir, sendConsoleOutput) {
  const gameitemsDir = path.join(dir, 'gameitems');
  const playfieldPath = path.join(gameitemsDir, 'Primitive.playfield_mesh.json');

  if (await fileExists(playfieldPath)) {
    try {
      const content = JSON.parse(await fs.promises.readFile(playfieldPath, 'utf-8'));
      if (content.Primitive && content.Primitive.is_visible === false) {
        content.Primitive.is_visible = true;
        await fs.promises.writeFile(playfieldPath, JSON.stringify(content, null, 2));
        if (sendConsoleOutput) {
          sendConsoleOutput('info', 'Fixed playfield_mesh visibility (pre-10.8 table workaround)');
        }
      }
    } catch (err) {
      if (sendConsoleOutput) {
        sendConsoleOutput('error', `Failed to upgrade playfield_mesh: ${err.message}`);
      }
    }
  }
}

export async function upgradeOldMaterialsFormat(dir) {
  const oldMatPath = path.join(dir, 'materials-old.json');
  const oldPhysPath = path.join(dir, 'materials-physics-old.json');
  const newMatPath = path.join(dir, 'materials.json');
  const versionPath = path.join(dir, 'version.txt');

  if ((await fileExists(oldMatPath)) && !(await fileExists(newMatPath))) {
    const oldMaterials = JSON.parse(await fs.promises.readFile(oldMatPath, 'utf-8'));
    const oldPhysics = (await fileExists(oldPhysPath))
      ? JSON.parse(await fs.promises.readFile(oldPhysPath, 'utf-8'))
      : [];

    const newMaterials = convertOldToNewMaterials(oldMaterials, oldPhysics);

    await fs.promises.writeFile(newMatPath, JSON.stringify(newMaterials, null, 2));

    await fs.promises.unlink(oldMatPath);
    if (await fileExists(oldPhysPath)) {
      await fs.promises.unlink(oldPhysPath);
    }

    await fs.promises.writeFile(versionPath, '1081');
    return true;
  }
  return false;
}

function sanitizeLayerName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

function getInitialPartGroupName(itemInfo) {
  const layerIndex = itemInfo.editor_layer ?? 0;
  const layerName = itemInfo.editor_layer_name;

  if (!layerName) {
    return layerIndex < 9 ? `Layer_0${layerIndex + 1}` : `Layer_${layerIndex + 1}`;
  }

  const sanitized = sanitizeLayerName(layerName);
  return `Layer_${sanitized}`;
}

function isPurelyNumeric(str) {
  return /^[0-9]+$/.test(str);
}

export async function upgradeLayersToPartGroups(dir, sendConsoleOutput) {
  const gameitemsPath = path.join(dir, 'gameitems.json');
  const gameitemsDir = path.join(dir, 'gameitems');

  if (!(await fileExists(gameitemsPath))) return false;

  const gameitems = JSON.parse(await fs.promises.readFile(gameitemsPath, 'utf-8'));

  const hasPartGroups = gameitems.some(item => item.file_name.startsWith('PartGroup.'));
  if (hasPartGroups) return false;

  const layers = new Map();
  const allItemNames = new Set();

  for (const itemInfo of gameitems) {
    const initialGroupName = getInitialPartGroupName(itemInfo);

    if (!layers.has(initialGroupName)) {
      layers.set(initialGroupName, { items: [] });
    }
    layers.get(initialGroupName).items.push(itemInfo);

    const itemBaseName = itemInfo.file_name.replace(/^[^.]+\./, '').replace(/\.json$/, '');
    allItemNames.add(itemBaseName.toLowerCase());
  }

  let script = '';
  const scriptPath = path.join(dir, 'script.vbs');
  if (await fileExists(scriptPath)) {
    script = (await fs.promises.readFile(scriptPath, 'utf-8')).toLowerCase();
  }

  const groupNameRemap = new Map();
  const finalGroupNames = new Set();

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

  const newGameitems = [...gameitems];

  for (const [initialGroupName, layerData] of layers) {
    const groupName = groupNameRemap.get(initialGroupName);

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

    const partGroupFileName = `PartGroup.${groupName}.json`;
    const partGroupPath = path.join(gameitemsDir, partGroupFileName);
    await fs.promises.writeFile(partGroupPath, JSON.stringify(partGroup, null, 2));

    newGameitems.push({
      file_name: partGroupFileName,
      is_locked: false,
      editor_layer: 0,
      editor_layer_name: '',
      editor_layer_visibility: true,
    });

    for (const itemInfo of layerData.items) {
      const itemPath = path.join(gameitemsDir, itemInfo.file_name);
      if (await fileExists(itemPath)) {
        const itemContent = JSON.parse(await fs.promises.readFile(itemPath, 'utf-8'));
        const type = Object.keys(itemContent)[0];
        if (itemContent[type]) {
          itemContent[type].part_group_name = groupName;
          await fs.promises.writeFile(itemPath, JSON.stringify(itemContent, null, 2));
        }
      }
    }
  }

  await fs.promises.writeFile(gameitemsPath, JSON.stringify(newGameitems, null, 2));

  const groupNames = [...groupNameRemap.values()].join(', ');
  if (sendConsoleOutput) {
    sendConsoleOutput('info', `Upgraded ${layers.size} legacy layers to PartGroups: ${groupNames}`);
  }

  return true;
}

export async function upgradePartGroupIsLocked(dir, sendConsoleOutput) {
  const gameitemsDir = path.join(dir, 'gameitems');
  if (!(await fileExists(gameitemsDir))) return false;

  const files = await fs.promises.readdir(gameitemsDir);
  const partGroupFiles = files.filter(f => f.startsWith('PartGroup.') && f.endsWith('.json'));

  let upgraded = 0;
  for (const file of partGroupFiles) {
    const filePath = path.join(gameitemsDir, file);
    try {
      const content = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
      if (content.PartGroup && content.PartGroup.is_locked === undefined) {
        content.PartGroup.is_locked = false;
        await fs.promises.writeFile(filePath, JSON.stringify(content, null, 2));
        upgraded++;
      }
    } catch (err) {
      if (sendConsoleOutput) {
        sendConsoleOutput('error', `Failed to upgrade ${file}: ${err.message}`);
      }
    }
  }

  if (upgraded > 0 && sendConsoleOutput) {
    sendConsoleOutput('info', `Added missing is_locked field to ${upgraded} PartGroup file(s)`);
  }

  return upgraded > 0;
}

export async function cleanupCollectionItems(dir, sendConsoleOutput) {
  const collectionsPath = path.join(dir, 'collections.json');
  const gameitemsPath = path.join(dir, 'gameitems.json');

  if (!(await fileExists(collectionsPath)) || !(await fileExists(gameitemsPath))) {
    return false;
  }

  const collections = JSON.parse(await fs.promises.readFile(collectionsPath, 'utf-8'));
  const gameitems = JSON.parse(await fs.promises.readFile(gameitemsPath, 'utf-8'));

  const validItemNames = new Set();
  for (const item of gameitems) {
    const name = item.file_name.replace(/^[^.]+\./, '').replace(/\.json$/, '');
    validItemNames.add(name);
  }

  let modified = false;
  const removedItems = [];

  for (const collection of collections) {
    const originalCount = collection.items.length;
    const validItems = collection.items.filter(itemName => {
      if (validItemNames.has(itemName)) {
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
    await fs.promises.writeFile(collectionsPath, JSON.stringify(collections, null, 2));
    if (sendConsoleOutput) {
      for (const { collection, item } of removedItems) {
        sendConsoleOutput('warn', `Removed missing item "${item}" from collection "${collection}"`);
      }
    }
  }

  return modified;
}
