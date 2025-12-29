import { UndoRecord } from './undo-record.js';
import { state, elements } from '../state.js';
import { getItemNameFromFileName } from '../utils.js';

class UndoManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoLevels = 500;
    this.transactionDepth = 0;
    this.currentRecord = null;
    this.enabled = true;
    this.onChangeCallback = null;
    this.savePointIndex = 0;
  }

  setOnChange(callback) {
    this.onChangeCallback = callback;
  }

  _notifyChange() {
    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  beginUndo(description = '') {
    if (!this.enabled) return;
    this.transactionDepth++;

    if (this.transactionDepth === 1) {
      if (this.undoStack.length >= this.maxUndoLevels) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.currentRecord = new UndoRecord(description);
    }
  }

  markForUndo(itemName) {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.snapshots.has(itemName)) return;
    if (this.currentRecord.createdItems.includes(itemName)) return;

    const item = state.items[itemName];
    if (!item) return;

    this.currentRecord.snapshots.set(itemName, {
      before: this._createItemSnapshot(item, itemName),
      after: null,
    });
  }

  markForCreate(itemName) {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.createdItems.push(itemName);
    this._markGameitemsListForUndo();
  }

  markForDelete(itemName) {
    if (!this.enabled || !this.currentRecord) return;

    const item = state.items[itemName];
    if (!item) return;

    this.currentRecord.deletedItems.set(itemName, this._createItemSnapshot(item, itemName));
    this._markGameitemsListForUndo();
  }

  markForRename(oldName, newName, oldFileName, newFileName) {
    if (!this.enabled || !this.currentRecord) return;

    this.currentRecord.renamedItems.push({
      oldName,
      newName,
      oldFileName,
      newFileName,
    });
    this._markGameitemsListForUndo();
  }

  markGamedataForUndo() {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.gamedataBefore !== null) return;

    this.currentRecord.gamedataBefore = JSON.parse(JSON.stringify(state.gamedata));
    this.currentRecord.backglassViewMode = state.backglassViewMode;
  }

  markImagesForUndo() {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.imagesBefore !== null) return;

    this.currentRecord.imagesBefore = JSON.parse(JSON.stringify(state.images));
  }

  markImageForCreate(imageName) {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.createdImages.push(imageName);
    this.markImagesForUndo();
  }

  markImageForDelete(imageName, imageData, filePath) {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.deletedImages.set(imageName, { data: imageData, filePath });
    this.markImagesForUndo();
  }

  markMaterialsForUndo() {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.materialsBefore !== null) return;

    this.currentRecord.materialsBefore = JSON.parse(JSON.stringify(state.materials));
  }

  markMaterialForCreate(materialName) {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.createdMaterials.push(materialName);
    this.markMaterialsForUndo();
  }

  markMaterialForDelete(materialName, materialData) {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.deletedMaterials.set(materialName, materialData);
    this.markMaterialsForUndo();
  }

  markRenderProbesForUndo() {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.renderProbesBefore !== null) return;

    this.currentRecord.renderProbesBefore = JSON.parse(JSON.stringify(state.renderProbes));
  }

  markRenderProbeForCreate(probeName) {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.createdRenderProbes.push(probeName);
    this.markRenderProbesForUndo();
  }

  markRenderProbeForDelete(probeName, probeData) {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.deletedRenderProbes.set(probeName, probeData);
    this.markRenderProbesForUndo();
  }

  markInfoForUndo() {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.infoBefore !== null) return;

    this.currentRecord.infoBefore = JSON.parse(JSON.stringify(state.info || {}));
  }

  markGameitemsListForUndo() {
    this._markGameitemsListForUndo();
  }

  _markGameitemsListForUndo() {
    if (this.currentRecord.gameitemsListBefore !== null) return;
    this.currentRecord.gameitemsListBefore = JSON.parse(JSON.stringify(state.gameitems));
  }

  markCollectionsForUndo() {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.collectionsBefore !== null) return;

    this.currentRecord.collectionsBefore = JSON.parse(JSON.stringify(state.collections));
  }

  markVisibilityForUndo() {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.hiddenItemsBefore !== null) return;

    this.currentRecord.hiddenItemsBefore = state.hiddenItems ? Array.from(state.hiddenItems) : [];
  }

  recordScriptChange(before, after) {
    this.beginUndo('Edit Script');
    this.currentRecord.scriptBefore = before;
    this.currentRecord.scriptAfter = after;
    this.endUndo();
  }

  endUndo() {
    if (!this.enabled) return;
    if (this.transactionDepth <= 0) return;

    this.transactionDepth--;

    if (this.transactionDepth === 0 && this.currentRecord) {
      for (const [itemName, entry] of this.currentRecord.snapshots) {
        const item = state.items[itemName];
        if (item) {
          entry.after = this._createItemSnapshot(item, itemName);
        }
      }

      for (const itemName of this.currentRecord.createdItems) {
        const item = state.items[itemName];
        if (item) {
          this.currentRecord.snapshots.set(itemName, {
            before: null,
            after: this._createItemSnapshot(item, itemName),
          });
        }
      }

      if (this.currentRecord.gamedataBefore) {
        this.currentRecord.gamedataAfter = JSON.parse(JSON.stringify(state.gamedata));
      }

      if (this.currentRecord.infoBefore) {
        this.currentRecord.infoAfter = JSON.parse(JSON.stringify(state.info || {}));
      }

      if (this.currentRecord.imagesBefore) {
        this.currentRecord.imagesAfter = JSON.parse(JSON.stringify(state.images));
      }

      if (this.currentRecord.materialsBefore) {
        this.currentRecord.materialsAfter = JSON.parse(JSON.stringify(state.materials));
      }

      if (this.currentRecord.renderProbesBefore) {
        this.currentRecord.renderProbesAfter = JSON.parse(JSON.stringify(state.renderProbes));
      }

      if (this.currentRecord.gameitemsListBefore) {
        this.currentRecord.gameitemsListAfter = JSON.parse(JSON.stringify(state.gameitems));
      }

      if (this.currentRecord.collectionsBefore) {
        this.currentRecord.collectionsAfter = JSON.parse(JSON.stringify(state.collections));
      }

      if (this.currentRecord.hiddenItemsBefore !== null) {
        this.currentRecord.hiddenItemsAfter = state.hiddenItems ? Array.from(state.hiddenItems) : [];
      }

      if (this.currentRecord.hasChanges()) {
        this.undoStack.push(this.currentRecord);
        this._notifyChange();
        this._updateDirtyState();
      }

      this.currentRecord = null;
    }
  }

  cancelUndo() {
    if (this.transactionDepth > 0) {
      this.transactionDepth = 0;
      this.currentRecord = null;
    }
  }

  async undo() {
    if (!this.canUndo()) return false;

    this.enabled = false;
    const record = this.undoStack.pop();

    try {
      for (const [itemName, itemSnapshot] of record.deletedItems) {
        await this._restoreItem(itemSnapshot);
      }

      for (const [itemName, entry] of record.snapshots) {
        if (entry.before) {
          await this._restoreItem(entry.before);
        }
      }

      for (const itemName of record.createdItems) {
        await this._removeItem(itemName);
      }

      for (const rename of record.renamedItems) {
        await this._undoRename(rename);
      }

      if (record.gameitemsListBefore) {
        state.gameitems = record.gameitemsListBefore;
        await this._saveGameitemsList();
      }

      if (record.gamedataBefore) {
        state.gamedata = record.gamedataBefore;
        await this._saveGamedata();
        if (record.backglassViewMode) {
          state.backglassViewMode = record.backglassViewMode;
        }
      }

      if (record.infoBefore) {
        state.info = record.infoBefore;
        await this._saveInfo();
      }

      if (record.imagesBefore) {
        state.images = record.imagesBefore;
        state.imageNames = Object.keys(state.images).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        await this._saveImages();
      }

      for (const imageName of record.createdImages) {
        await this._removeImage(imageName);
      }

      for (const [imageName, imageInfo] of record.deletedImages) {
        await this._restoreImage(imageName, imageInfo);
      }

      if (record.materialsBefore) {
        state.materials = record.materialsBefore;
        state.materialNames = Object.keys(state.materials).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveMaterials();
      }

      for (const materialName of record.createdMaterials) {
        delete state.materials[materialName];
      }

      for (const [materialName, materialData] of record.deletedMaterials) {
        state.materials[materialName] = materialData;
      }

      if (record.createdMaterials.length > 0 || record.deletedMaterials.size > 0) {
        state.materialNames = Object.keys(state.materials).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveMaterials();
      }

      if (record.renderProbesBefore) {
        state.renderProbes = record.renderProbesBefore;
        state.renderProbeNames = Object.keys(state.renderProbes).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveRenderProbes();
      }

      for (const probeName of record.createdRenderProbes) {
        delete state.renderProbes[probeName];
      }

      for (const [probeName, probeData] of record.deletedRenderProbes) {
        state.renderProbes[probeName] = probeData;
      }

      if (record.createdRenderProbes.length > 0 || record.deletedRenderProbes.size > 0) {
        state.renderProbeNames = Object.keys(state.renderProbes).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveRenderProbes();
      }

      if (record.collectionsBefore) {
        state.collections = record.collectionsBefore;
        await this._saveCollections();
      }

      if (record.hiddenItemsBefore !== null) {
        state.hiddenItems = new Set(record.hiddenItemsBefore);
      }

      if (record.scriptBefore !== null) {
        await this._saveScript(record.scriptBefore);
      }

      this.redoStack.push(record);
      this._notifyChange();
      this._updateDirtyState();
      this._updateStatusBar(`Undo: ${record.description}`);

      let selectItems = undefined;

      if (record.deletedItems.size > 0) {
        selectItems = [...record.deletedItems.keys()];
      } else if (record.renamedItems.length > 0) {
        selectItems = [record.renamedItems[0].oldName];
      } else if (record.snapshots.size > 0) {
        for (const [itemName, entry] of record.snapshots) {
          if (!record.createdItems.includes(itemName)) {
            selectItems = [itemName];
            break;
          }
        }
      }

      if (selectItems === undefined && record.createdItems.length > 0) {
        selectItems = [];
      }

      return { success: true, selectItems };
    } catch (error) {
      console.error('Undo failed:', error);
      this._updateStatusBar(`Undo failed: ${error.message}`);
      return { success: false };
    } finally {
      this.enabled = true;
    }
  }

  async redo() {
    if (!this.canRedo()) return false;

    this.enabled = false;
    const record = this.redoStack.pop();

    try {
      for (const [itemName, itemSnapshot] of record.deletedItems) {
        await this._removeItem(itemName);
      }

      for (const [itemName, entry] of record.snapshots) {
        if (entry.after) {
          await this._restoreItem(entry.after);
        }
      }

      for (const itemName of record.createdItems) {
        const entry = record.snapshots.get(itemName);
        if (entry && entry.after) {
          await this._restoreItem(entry.after);
        }
      }

      for (const rename of record.renamedItems) {
        await this._redoRename(rename);
      }

      if (record.gameitemsListAfter) {
        state.gameitems = record.gameitemsListAfter;
        await this._saveGameitemsList();
      }

      if (record.gamedataAfter) {
        state.gamedata = record.gamedataAfter;
        await this._saveGamedata();
        if (record.backglassViewMode) {
          state.backglassViewMode = record.backglassViewMode;
        }
      }

      if (record.infoAfter) {
        state.info = record.infoAfter;
        await this._saveInfo();
      }

      if (record.imagesAfter) {
        state.images = record.imagesAfter;
        state.imageNames = Object.keys(state.images).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        await this._saveImages();
      }

      for (const [imageName, imageInfo] of record.deletedImages) {
        await this._removeImage(imageName);
      }

      for (const imageName of record.createdImages) {
        // The image should already be in imagesAfter
      }

      if (record.materialsAfter) {
        state.materials = record.materialsAfter;
        state.materialNames = Object.keys(state.materials).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveMaterials();
      }

      if (record.renderProbesAfter) {
        state.renderProbes = record.renderProbesAfter;
        state.renderProbeNames = Object.keys(state.renderProbes).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveRenderProbes();
      }

      if (record.collectionsAfter) {
        state.collections = record.collectionsAfter;
        await this._saveCollections();
      }

      if (record.hiddenItemsAfter !== null) {
        state.hiddenItems = new Set(record.hiddenItemsAfter);
      }

      if (record.scriptAfter !== null) {
        await this._saveScript(record.scriptAfter);
      }

      this.undoStack.push(record);
      this._notifyChange();
      this._updateDirtyState();
      this._updateStatusBar(`Redo: ${record.description}`);

      let selectItems = undefined;

      if (record.createdItems.length > 0) {
        selectItems = [...record.createdItems];
      } else if (record.renamedItems.length > 0) {
        selectItems = [record.renamedItems[0].newName];
      } else if (record.snapshots.size > 0) {
        for (const [itemName, entry] of record.snapshots) {
          if (!record.deletedItems.has(itemName)) {
            selectItems = [itemName];
            break;
          }
        }
      } else if (record.deletedItems.size > 0) {
        selectItems = [];
      }

      return { success: true, selectItems };
    } catch (error) {
      console.error('Redo failed:', error);
      this._updateStatusBar(`Redo failed: ${error.message}`);
      return { success: false };
    } finally {
      this.enabled = true;
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.transactionDepth = 0;
    this.currentRecord = null;
    this.savePointIndex = 0;
    this._notifyChange();
  }

  markSavePoint() {
    this.savePointIndex = this.undoStack.length;
  }

  isAtSavePoint() {
    return this.undoStack.length === this.savePointIndex;
  }

  _updateDirtyState() {
    if (this.isAtSavePoint()) {
      window.vpxEditor?.markClean?.();
    } else {
      window.vpxEditor?.markDirty?.();
    }
  }

  getUndoDescription() {
    if (!this.canUndo()) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  getRedoDescription() {
    if (!this.canRedo()) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  _createItemSnapshot(item, itemName) {
    const data = {};
    for (const [key, value] of Object.entries(item)) {
      if (key.startsWith('_')) continue;
      data[key] = JSON.parse(JSON.stringify(value));
    }

    return {
      itemName,
      fileName: item._fileName,
      type: item._type,
      layer: item._layer,
      data,
    };
  }

  async _restoreItem(snapshot) {
    const data = JSON.parse(JSON.stringify(snapshot.data));
    const item = {
      ...data,
      _type: snapshot.type,
      _fileName: snapshot.fileName,
      _layer: snapshot.layer,
    };

    state.items[snapshot.itemName] = item;

    if (snapshot.type === 'PartGroup') {
      state.partGroups[snapshot.itemName] = item;
    }

    const saveData = { [snapshot.type]: {} };
    for (const [key, value] of Object.entries(data)) {
      saveData[snapshot.type][key] = value;
    }
    await window.vpxEditor.writeFile(`${state.extractedDir}/${snapshot.fileName}`, JSON.stringify(saveData, null, 2));

    const gameitemEntry = state.gameitems.find(gi => gi.file_name === snapshot.fileName.replace('gameitems/', ''));
    if (gameitemEntry && data.is_locked !== undefined) {
      gameitemEntry.is_locked = data.is_locked;
      await this._saveGameitemsList();
    }
  }

  async _removeItem(itemName) {
    const item = state.items[itemName];
    if (!item) return;

    if (item._type === 'PartGroup') {
      delete state.partGroups[itemName];
    }

    delete state.items[itemName];

    const fileNameOnly = item._fileName?.replace('gameitems/', '');
    const index = state.gameitems.findIndex(
      gi => gi.file_name === fileNameOnly || (gi.file_name && getItemNameFromFileName(gi.file_name) === itemName)
    );
    if (index >= 0) {
      state.gameitems.splice(index, 1);
      await this._saveGameitemsList();
    }
  }

  async _undoRename(rename) {
    const item = state.items[rename.newName];
    if (!item) return;

    delete state.items[rename.newName];
    if (item._type === 'PartGroup') {
      delete state.partGroups[rename.newName];
    }

    item.name = rename.oldName;
    item._fileName = rename.oldFileName;
    state.items[rename.oldName] = item;
    if (item._type === 'PartGroup') {
      state.partGroups[rename.oldName] = item;
      for (const [itemName, refItem] of Object.entries(state.items)) {
        if (refItem.part_group_name === rename.newName) {
          refItem.part_group_name = rename.oldName;
          await this._saveItem(itemName, refItem);
        }
      }
    }

    await window.vpxEditor.renameFile(
      `${state.extractedDir}/${rename.newFileName}`,
      `${state.extractedDir}/${rename.oldFileName}`
    );

    const saveData = { [item._type]: {} };
    for (const [key, value] of Object.entries(item)) {
      if (!key.startsWith('_')) {
        saveData[item._type][key] = value;
      }
    }
    await window.vpxEditor.writeFile(`${state.extractedDir}/${rename.oldFileName}`, JSON.stringify(saveData, null, 2));
  }

  async _redoRename(rename) {
    const item = state.items[rename.oldName];
    if (!item) return;

    delete state.items[rename.oldName];
    if (item._type === 'PartGroup') {
      delete state.partGroups[rename.oldName];
    }

    item.name = rename.newName;
    item._fileName = rename.newFileName;
    state.items[rename.newName] = item;
    if (item._type === 'PartGroup') {
      state.partGroups[rename.newName] = item;
      for (const [itemName, refItem] of Object.entries(state.items)) {
        if (refItem.part_group_name === rename.oldName) {
          refItem.part_group_name = rename.newName;
          await this._saveItem(itemName, refItem);
        }
      }
    }

    await window.vpxEditor.renameFile(
      `${state.extractedDir}/${rename.oldFileName}`,
      `${state.extractedDir}/${rename.newFileName}`
    );

    const saveData = { [item._type]: {} };
    for (const [key, value] of Object.entries(item)) {
      if (!key.startsWith('_')) {
        saveData[item._type][key] = value;
      }
    }
    await window.vpxEditor.writeFile(`${state.extractedDir}/${rename.newFileName}`, JSON.stringify(saveData, null, 2));
  }

  async _saveItem(itemName, item) {
    if (!item._fileName) return;
    const saveData = { [item._type]: {} };
    for (const [key, value] of Object.entries(item)) {
      if (!key.startsWith('_')) {
        saveData[item._type][key] = value;
      }
    }
    await window.vpxEditor.writeFile(`${state.extractedDir}/${item._fileName}`, JSON.stringify(saveData, null, 2));
  }

  async _saveGameitemsList() {
    const gameitems = state.gameitems.map(gi => {
      const entry = { file_name: gi.file_name };
      if (gi.is_locked !== undefined) entry.is_locked = gi.is_locked;
      if (gi.editor_layer !== undefined) entry.editor_layer = gi.editor_layer;
      if (gi.editor_layer_name !== undefined) entry.editor_layer_name = gi.editor_layer_name;
      if (gi.editor_layer_visibility !== undefined) entry.editor_layer_visibility = gi.editor_layer_visibility;
      return entry;
    });
    await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(gameitems, null, 2));
  }

  async _saveGamedata() {
    await window.vpxEditor.writeFile(`${state.extractedDir}/gamedata.json`, JSON.stringify(state.gamedata, null, 2));
  }

  async _saveInfo() {
    await window.vpxEditor.writeFile(`${state.extractedDir}/info.json`, JSON.stringify(state.info, null, 2));
  }

  async _saveImages() {
    const imagesArray = Object.values(state.images);
    await window.vpxEditor.writeFile(`${state.extractedDir}/images.json`, JSON.stringify(imagesArray, null, 2));
  }

  async _saveMaterials() {
    const materialsArray = Object.values(state.materials);
    await window.vpxEditor.writeFile(`${state.extractedDir}/materials.json`, JSON.stringify(materialsArray, null, 2));
  }

  async _saveCollections() {
    await window.vpxEditor.writeFile(
      `${state.extractedDir}/collections.json`,
      JSON.stringify(state.collections, null, 2)
    );
  }

  async _saveRenderProbes() {
    const renderProbesArray = Object.values(state.renderProbes);
    await window.vpxEditor.writeFile(
      `${state.extractedDir}/renderprobes.json`,
      JSON.stringify(renderProbesArray, null, 2)
    );
  }

  async _saveScript(content) {
    await window.vpxEditor.writeFile(`${state.extractedDir}/script.vbs`, content);
    window.vpxEditor.notifyScriptUndone?.();
  }

  async _removeImage(imageName) {
    const image = state.images[imageName];
    if (image && image.path) {
      await window.vpxEditor.deleteFile(`${state.extractedDir}/${image.path}`);
    }
    delete state.images[imageName];
    state.imageNames = Object.keys(state.images).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    await this._saveImages();
  }

  async _restoreImage(imageName, imageInfo) {
    state.images[imageName] = imageInfo.data;
    state.imageNames = Object.keys(state.images).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    await this._saveImages();
  }

  _updateStatusBar(message) {
    if (elements.statusBar) {
      elements.statusBar.textContent = message;
    }
  }
}

export const undoManager = new UndoManager();
