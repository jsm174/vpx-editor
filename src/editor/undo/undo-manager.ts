import { UndoRecord, ItemSnapshot, RenameEntry, DeletedImageInfo } from './undo-record.js';
import { state, elements } from '../state.js';
import { getItemNameFromFileName } from '../utils.js';

interface EditorItem {
  _type: string;
  _fileName: string;
  _layer: number;
  name?: string;
  is_locked?: boolean;
  part_group_name?: string;
  [key: string]: unknown;
}

interface GameitemEntry {
  file_name: string;
  is_locked?: boolean;
  editor_layer?: number;
  editor_layer_name?: string;
  editor_layer_visibility?: boolean;
}

interface ImageEntry {
  path?: string;
  [key: string]: unknown;
}

type OnChangeCallback = () => void;

interface UndoRedoResult {
  success: boolean;
  selectItems?: string[];
}

class UndoManager {
  undoStack: UndoRecord[];
  redoStack: UndoRecord[];
  maxUndoLevels: number;
  transactionDepth: number;
  currentRecord: UndoRecord | null;
  enabled: boolean;
  onChangeCallback: OnChangeCallback | null;
  savePointIndex: number;

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

  setOnChange(callback: OnChangeCallback): void {
    this.onChangeCallback = callback;
  }

  _notifyChange(): void {
    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  beginUndo(description: string = ''): void {
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

  markForUndo(itemName: string): void {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.snapshots.has(itemName)) return;
    if (this.currentRecord.createdItems.includes(itemName)) return;

    const item = (state.items as Record<string, EditorItem>)[itemName];
    if (!item) return;

    this.currentRecord.snapshots.set(itemName, {
      before: this._createItemSnapshot(item, itemName),
      after: null,
    });
  }

  markForCreate(itemName: string): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.createdItems.push(itemName);
    this._markGameitemsListForUndo();
  }

  markForDelete(itemName: string): void {
    if (!this.enabled || !this.currentRecord) return;

    const item = (state.items as Record<string, EditorItem>)[itemName];
    if (!item) return;

    this.currentRecord.deletedItems.set(itemName, this._createItemSnapshot(item, itemName));
    this._markGameitemsListForUndo();
  }

  markForRename(oldName: string, newName: string, oldFileName: string, newFileName: string): void {
    if (!this.enabled || !this.currentRecord) return;

    this.currentRecord.renamedItems.push({
      oldName,
      newName,
      oldFileName,
      newFileName,
    });
    this._markGameitemsListForUndo();
  }

  markGamedataForUndo(): void {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.gamedataBefore !== null) return;

    this.currentRecord.gamedataBefore = JSON.parse(JSON.stringify(state.gamedata));
    this.currentRecord.backglassViewMode = state.backglassViewMode as string;
  }

  markImagesForUndo(): void {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.imagesBefore !== null) return;

    this.currentRecord.imagesBefore = JSON.parse(JSON.stringify(state.images));
  }

  markImageForCreate(imageName: string): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.createdImages.push(imageName);
    this.markImagesForUndo();
  }

  markImageForDelete(imageName: string, imageData: unknown, filePath: string): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.deletedImages.set(imageName, { data: imageData, filePath });
    this.markImagesForUndo();
  }

  markMaterialsForUndo(): void {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.materialsBefore !== null) return;

    this.currentRecord.materialsBefore = JSON.parse(JSON.stringify(state.materials));
  }

  markMaterialForCreate(materialName: string): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.createdMaterials.push(materialName);
    this.markMaterialsForUndo();
  }

  markMaterialForDelete(materialName: string, materialData: unknown): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.deletedMaterials.set(materialName, materialData);
    this.markMaterialsForUndo();
  }

  markRenderProbesForUndo(): void {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.renderProbesBefore !== null) return;

    this.currentRecord.renderProbesBefore = JSON.parse(JSON.stringify(state.renderProbes));
  }

  markRenderProbeForCreate(probeName: string): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.createdRenderProbes.push(probeName);
    this.markRenderProbesForUndo();
  }

  markRenderProbeForDelete(probeName: string, probeData: unknown): void {
    if (!this.enabled || !this.currentRecord) return;
    this.currentRecord.deletedRenderProbes.set(probeName, probeData);
    this.markRenderProbesForUndo();
  }

  markInfoForUndo(): void {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.infoBefore !== null) return;

    this.currentRecord.infoBefore = JSON.parse(JSON.stringify(state.info || {}));
  }

  markGameitemsListForUndo(): void {
    this._markGameitemsListForUndo();
  }

  _markGameitemsListForUndo(): void {
    if (!this.currentRecord) return;
    if (this.currentRecord.gameitemsListBefore !== null) return;
    this.currentRecord.gameitemsListBefore = JSON.parse(JSON.stringify(state.gameitems));
  }

  markCollectionsForUndo(): void {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.collectionsBefore !== null) return;

    this.currentRecord.collectionsBefore = JSON.parse(JSON.stringify(state.collections));
  }

  markVisibilityForUndo(): void {
    if (!this.enabled || !this.currentRecord) return;
    if (this.currentRecord.hiddenItemsBefore !== null) return;

    this.currentRecord.hiddenItemsBefore = state.hiddenItems ? Array.from(state.hiddenItems as Set<string>) : [];
  }

  recordScriptChange(before: string, after: string): void {
    this.beginUndo('Edit Script');
    if (this.currentRecord) {
      this.currentRecord.scriptBefore = before;
      this.currentRecord.scriptAfter = after;
    }
    this.endUndo();
  }

  endUndo(): void {
    if (!this.enabled) return;
    if (this.transactionDepth <= 0) return;

    this.transactionDepth--;

    if (this.transactionDepth === 0 && this.currentRecord) {
      for (const [itemName, entry] of this.currentRecord.snapshots) {
        const item = (state.items as Record<string, EditorItem>)[itemName];
        if (item) {
          entry.after = this._createItemSnapshot(item, itemName);
        }
      }

      for (const itemName of this.currentRecord.createdItems) {
        const item = (state.items as Record<string, EditorItem>)[itemName];
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
        this.currentRecord.hiddenItemsAfter = state.hiddenItems ? Array.from(state.hiddenItems as Set<string>) : [];
      }

      if (this.currentRecord.hasChanges()) {
        this.undoStack.push(this.currentRecord);
        this._notifyChange();
        this._updateDirtyState();
      }

      this.currentRecord = null;
    }
  }

  cancelUndo(): void {
    if (this.transactionDepth > 0) {
      this.transactionDepth = 0;
      this.currentRecord = null;
    }
  }

  async undo(): Promise<UndoRedoResult | false> {
    if (!this.canUndo()) return false;

    this.enabled = false;
    const record = this.undoStack.pop()!;

    try {
      for (const [, itemSnapshot] of record.deletedItems) {
        await this._restoreItem(itemSnapshot);
      }

      for (const [, entry] of record.snapshots) {
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
        (state as { gameitems: unknown[] }).gameitems = record.gameitemsListBefore as unknown[];
        await this._saveGameitemsList();
      }

      if (record.gamedataBefore) {
        (state as { gamedata: unknown }).gamedata = record.gamedataBefore;
        await this._saveGamedata();
        if (record.backglassViewMode) {
          (state as { backglassViewMode: string }).backglassViewMode = record.backglassViewMode;
        }
      }

      if (record.infoBefore) {
        (state as { info: unknown }).info = record.infoBefore;
        await this._saveInfo();
      }

      if (record.imagesBefore) {
        (state as { images: Record<string, unknown> }).images = record.imagesBefore as Record<string, unknown>;
        (state as { imageNames: string[] }).imageNames = Object.keys(state.images).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveImages();
      }

      for (const imageName of record.createdImages) {
        await this._removeImage(imageName);
      }

      for (const [imageName, imageInfo] of record.deletedImages) {
        await this._restoreImage(imageName, imageInfo);
      }

      if (record.materialsBefore) {
        (state as { materials: Record<string, unknown> }).materials = record.materialsBefore as Record<string, unknown>;
        (state as { materialNames: string[] }).materialNames = Object.keys(state.materials).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveMaterials();
      }

      for (const materialName of record.createdMaterials) {
        delete (state.materials as Record<string, unknown>)[materialName];
      }

      for (const [materialName, materialData] of record.deletedMaterials) {
        (state.materials as Record<string, unknown>)[materialName] = materialData;
      }

      if (record.createdMaterials.length > 0 || record.deletedMaterials.size > 0) {
        (state as { materialNames: string[] }).materialNames = Object.keys(state.materials).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveMaterials();
      }

      if (record.renderProbesBefore) {
        (state as { renderProbes: Record<string, unknown> }).renderProbes = record.renderProbesBefore as Record<
          string,
          unknown
        >;
        (state as { renderProbeNames: string[] }).renderProbeNames = Object.keys(state.renderProbes).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveRenderProbes();
      }

      for (const probeName of record.createdRenderProbes) {
        delete (state.renderProbes as Record<string, unknown>)[probeName];
      }

      for (const [probeName, probeData] of record.deletedRenderProbes) {
        (state.renderProbes as Record<string, unknown>)[probeName] = probeData;
      }

      if (record.createdRenderProbes.length > 0 || record.deletedRenderProbes.size > 0) {
        (state as { renderProbeNames: string[] }).renderProbeNames = Object.keys(state.renderProbes).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveRenderProbes();
      }

      if (record.collectionsBefore) {
        (state as { collections: unknown[] }).collections = record.collectionsBefore as unknown[];
        await this._saveCollections();
      }

      if (record.hiddenItemsBefore !== null) {
        (state as { hiddenItems: Set<string> }).hiddenItems = new Set(record.hiddenItemsBefore);
      }

      if (record.scriptBefore !== null) {
        await this._saveScript(record.scriptBefore);
      }

      this.redoStack.push(record);
      this._notifyChange();
      this._updateDirtyState();
      this._updateStatusBar(`Undo: ${record.description}`);

      let selectItems: string[] | undefined = undefined;

      if (record.deletedItems.size > 0) {
        selectItems = [...record.deletedItems.keys()];
      } else if (record.renamedItems.length > 0) {
        selectItems = [record.renamedItems[0].oldName];
      } else if (record.snapshots.size > 0) {
        for (const [snapshotItemName] of record.snapshots) {
          if (!record.createdItems.includes(snapshotItemName)) {
            selectItems = [snapshotItemName];
            break;
          }
        }
      }

      if (selectItems === undefined && record.createdItems.length > 0) {
        selectItems = [];
      }

      return { success: true, selectItems };
    } catch (error: unknown) {
      console.error('Undo failed:', error);
      this._updateStatusBar(`Undo failed: ${(error as Error).message}`);
      return { success: false };
    } finally {
      this.enabled = true;
    }
  }

  async redo(): Promise<UndoRedoResult | false> {
    if (!this.canRedo()) return false;

    this.enabled = false;
    const record = this.redoStack.pop()!;

    try {
      for (const [deletedItemName] of record.deletedItems) {
        await this._removeItem(deletedItemName);
      }

      for (const [, entry] of record.snapshots) {
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
        (state as { gameitems: unknown[] }).gameitems = record.gameitemsListAfter as unknown[];
        await this._saveGameitemsList();
      }

      if (record.gamedataAfter) {
        (state as { gamedata: unknown }).gamedata = record.gamedataAfter;
        await this._saveGamedata();
        if (record.backglassViewMode) {
          (state as { backglassViewMode: string }).backglassViewMode = record.backglassViewMode;
        }
      }

      if (record.infoAfter) {
        (state as { info: unknown }).info = record.infoAfter;
        await this._saveInfo();
      }

      if (record.imagesAfter) {
        (state as { images: Record<string, unknown> }).images = record.imagesAfter as Record<string, unknown>;
        (state as { imageNames: string[] }).imageNames = Object.keys(state.images).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveImages();
      }

      for (const [deletedImageName] of record.deletedImages) {
        await this._removeImage(deletedImageName);
      }

      if (record.materialsAfter) {
        (state as { materials: Record<string, unknown> }).materials = record.materialsAfter as Record<string, unknown>;
        (state as { materialNames: string[] }).materialNames = Object.keys(state.materials).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveMaterials();
      }

      if (record.renderProbesAfter) {
        (state as { renderProbes: Record<string, unknown> }).renderProbes = record.renderProbesAfter as Record<
          string,
          unknown
        >;
        (state as { renderProbeNames: string[] }).renderProbeNames = Object.keys(state.renderProbes).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        await this._saveRenderProbes();
      }

      if (record.collectionsAfter) {
        (state as { collections: unknown[] }).collections = record.collectionsAfter as unknown[];
        await this._saveCollections();
      }

      if (record.hiddenItemsAfter !== null) {
        (state as { hiddenItems: Set<string> }).hiddenItems = new Set(record.hiddenItemsAfter);
      }

      if (record.scriptAfter !== null) {
        await this._saveScript(record.scriptAfter);
      }

      this.undoStack.push(record);
      this._notifyChange();
      this._updateDirtyState();
      this._updateStatusBar(`Redo: ${record.description}`);

      let selectItems: string[] | undefined = undefined;

      if (record.createdItems.length > 0) {
        selectItems = [...record.createdItems];
      } else if (record.renamedItems.length > 0) {
        selectItems = [record.renamedItems[0].newName];
      } else if (record.snapshots.size > 0) {
        for (const [redoItemName] of record.snapshots) {
          if (!record.deletedItems.has(redoItemName)) {
            selectItems = [redoItemName];
            break;
          }
        }
      } else if (record.deletedItems.size > 0) {
        selectItems = [];
      }

      return { success: true, selectItems };
    } catch (error: unknown) {
      console.error('Redo failed:', error);
      this._updateStatusBar(`Redo failed: ${(error as Error).message}`);
      return { success: false };
    } finally {
      this.enabled = true;
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.transactionDepth = 0;
    this.currentRecord = null;
    this.savePointIndex = 0;
    this._notifyChange();
  }

  markSavePoint(): void {
    this.savePointIndex = this.undoStack.length;
  }

  isAtSavePoint(): boolean {
    return this.undoStack.length === this.savePointIndex;
  }

  _updateDirtyState(): void {
    if (this.isAtSavePoint()) {
      window.vpxEditor.markClean();
    } else {
      window.vpxEditor.markDirty();
    }
  }

  getUndoDescription(): string | null {
    if (!this.canUndo()) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  getRedoDescription(): string | null {
    if (!this.canRedo()) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  _createItemSnapshot(item: EditorItem, itemName: string): ItemSnapshot {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      if (key.startsWith('_')) continue;
      if (value === undefined) continue;
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

  async _restoreItem(snapshot: ItemSnapshot): Promise<void> {
    const data = JSON.parse(JSON.stringify(snapshot.data));
    const item: EditorItem = {
      ...data,
      _type: snapshot.type,
      _fileName: snapshot.fileName,
      _layer: snapshot.layer,
    };

    (state.items as Record<string, EditorItem>)[snapshot.itemName] = item;

    if (snapshot.type === 'PartGroup') {
      (state.partGroups as Record<string, EditorItem>)[snapshot.itemName] = item;
    }

    const saveData: Record<string, Record<string, unknown>> = { [snapshot.type]: {} };
    for (const [key, value] of Object.entries(data)) {
      saveData[snapshot.type][key] = value;
    }
    await window.vpxEditor.writeFile(`${state.extractedDir}/${snapshot.fileName}`, JSON.stringify(saveData, null, 2));

    const gameitemEntry = (state.gameitems as GameitemEntry[]).find(
      gi => gi.file_name === snapshot.fileName.replace('gameitems/', '')
    );
    if (gameitemEntry && data.is_locked !== undefined) {
      gameitemEntry.is_locked = data.is_locked as boolean;
      await this._saveGameitemsList();
    }
  }

  async _removeItem(itemName: string): Promise<void> {
    const item = (state.items as Record<string, EditorItem>)[itemName];
    if (!item) return;

    if (item._type === 'PartGroup') {
      delete (state.partGroups as Record<string, EditorItem>)[itemName];
    }

    delete (state.items as Record<string, EditorItem>)[itemName];

    const fileNameOnly = item._fileName?.replace('gameitems/', '');
    const index = (state.gameitems as GameitemEntry[]).findIndex(
      gi => gi.file_name === fileNameOnly || (gi.file_name && getItemNameFromFileName(gi.file_name) === itemName)
    );
    if (index >= 0) {
      (state.gameitems as GameitemEntry[]).splice(index, 1);
      await this._saveGameitemsList();
    }
  }

  async _undoRename(rename: RenameEntry): Promise<void> {
    const item = (state.items as Record<string, EditorItem>)[rename.newName];
    if (!item) return;

    delete (state.items as Record<string, EditorItem>)[rename.newName];
    if (item._type === 'PartGroup') {
      delete (state.partGroups as Record<string, EditorItem>)[rename.newName];
    }

    item.name = rename.oldName;
    item._fileName = rename.oldFileName;
    (state.items as Record<string, EditorItem>)[rename.oldName] = item;
    if (item._type === 'PartGroup') {
      (state.partGroups as Record<string, EditorItem>)[rename.oldName] = item;
      for (const [itemName, refItem] of Object.entries(state.items as Record<string, EditorItem>)) {
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

    const saveData: Record<string, Record<string, unknown>> = { [item._type]: {} };
    for (const [key, value] of Object.entries(item)) {
      if (!key.startsWith('_')) {
        saveData[item._type][key] = value;
      }
    }
    await window.vpxEditor.writeFile(`${state.extractedDir}/${rename.oldFileName}`, JSON.stringify(saveData, null, 2));
  }

  async _redoRename(rename: RenameEntry): Promise<void> {
    const item = (state.items as Record<string, EditorItem>)[rename.oldName];
    if (!item) return;

    delete (state.items as Record<string, EditorItem>)[rename.oldName];
    if (item._type === 'PartGroup') {
      delete (state.partGroups as Record<string, EditorItem>)[rename.oldName];
    }

    item.name = rename.newName;
    item._fileName = rename.newFileName;
    (state.items as Record<string, EditorItem>)[rename.newName] = item;
    if (item._type === 'PartGroup') {
      (state.partGroups as Record<string, EditorItem>)[rename.newName] = item;
      for (const [itemName, refItem] of Object.entries(state.items as Record<string, EditorItem>)) {
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

    const saveData: Record<string, Record<string, unknown>> = { [item._type]: {} };
    for (const [key, value] of Object.entries(item)) {
      if (!key.startsWith('_')) {
        saveData[item._type][key] = value;
      }
    }
    await window.vpxEditor.writeFile(`${state.extractedDir}/${rename.newFileName}`, JSON.stringify(saveData, null, 2));
  }

  async _saveItem(_itemName: string, item: EditorItem): Promise<void> {
    if (!item._fileName) return;
    const saveData: Record<string, Record<string, unknown>> = { [item._type]: {} };
    for (const [key, value] of Object.entries(item)) {
      if (!key.startsWith('_')) {
        saveData[item._type][key] = value;
      }
    }
    await window.vpxEditor.writeFile(`${state.extractedDir}/${item._fileName}`, JSON.stringify(saveData, null, 2));
  }

  async _saveGameitemsList(): Promise<void> {
    const gameitems = (state.gameitems as GameitemEntry[]).map(gi => {
      const entry: GameitemEntry = { file_name: gi.file_name };
      if (gi.is_locked !== undefined) entry.is_locked = gi.is_locked;
      if (gi.editor_layer !== undefined) entry.editor_layer = gi.editor_layer;
      if (gi.editor_layer_name !== undefined) entry.editor_layer_name = gi.editor_layer_name;
      if (gi.editor_layer_visibility !== undefined) entry.editor_layer_visibility = gi.editor_layer_visibility;
      return entry;
    });
    await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(gameitems, null, 2));
  }

  async _saveGamedata(): Promise<void> {
    await window.vpxEditor.writeFile(`${state.extractedDir}/gamedata.json`, JSON.stringify(state.gamedata, null, 2));
  }

  async _saveInfo(): Promise<void> {
    await window.vpxEditor.writeFile(`${state.extractedDir}/info.json`, JSON.stringify(state.info, null, 2));
  }

  async _saveImages(): Promise<void> {
    const imagesArray = Object.values(state.images);
    await window.vpxEditor.writeFile(`${state.extractedDir}/images.json`, JSON.stringify(imagesArray, null, 2));
  }

  async _saveMaterials(): Promise<void> {
    const materialsArray = Object.values(state.materials);
    await window.vpxEditor.writeFile(`${state.extractedDir}/materials.json`, JSON.stringify(materialsArray, null, 2));
  }

  async _saveCollections(): Promise<void> {
    await window.vpxEditor.writeFile(
      `${state.extractedDir}/collections.json`,
      JSON.stringify(state.collections, null, 2)
    );
  }

  async _saveRenderProbes(): Promise<void> {
    const renderProbesArray = Object.values(state.renderProbes);
    await window.vpxEditor.writeFile(
      `${state.extractedDir}/renderprobes.json`,
      JSON.stringify(renderProbesArray, null, 2)
    );
  }

  async _saveScript(content: string): Promise<void> {
    await window.vpxEditor.writeFile(`${state.extractedDir}/script.vbs`, content);
    window.vpxEditor.notifyScriptUndone();
  }

  async _removeImage(imageName: string): Promise<void> {
    const image = (state.images as Record<string, ImageEntry>)[imageName];
    if (image && image.path) {
      await window.vpxEditor.deleteFile(`${state.extractedDir}/${image.path}`);
    }
    delete (state.images as Record<string, ImageEntry>)[imageName];
    (state as { imageNames: string[] }).imageNames = Object.keys(state.images).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    await this._saveImages();
  }

  async _restoreImage(imageName: string, imageInfo: DeletedImageInfo): Promise<void> {
    (state.images as Record<string, unknown>)[imageName] = imageInfo.data;
    (state as { imageNames: string[] }).imageNames = Object.keys(state.images).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    await this._saveImages();
  }

  _updateStatusBar(message: string): void {
    if (elements.statusBar) {
      (elements.statusBar as HTMLElement).textContent = message;
    }
  }
}

export const undoManager = new UndoManager();
