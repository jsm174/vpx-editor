export interface ItemSnapshot {
  itemName: string;
  fileName: string;
  type: string;
  layer: number;
  data: Record<string, unknown>;
}

export interface SnapshotEntry {
  before: ItemSnapshot | null;
  after: ItemSnapshot | null;
}

export interface RenameEntry {
  oldName: string;
  newName: string;
  oldFileName: string;
  newFileName: string;
}

export interface DeletedImageInfo {
  data: unknown;
  filePath: string;
}

export interface DeletedSoundInfo {
  data: unknown;
  filePath: string;
}

export interface UndoRecordJSON {
  id: number;
  timestamp: number;
  description: string;
  snapshots: [string, SnapshotEntry][];
  createdItems: string[];
  deletedItems: [string, ItemSnapshot][];
  renamedItems: RenameEntry[];
  gamedataBefore: Record<string, unknown> | null;
  gamedataAfter: Record<string, unknown> | null;
  backglassViewMode: string | null;
  infoBefore: Record<string, unknown> | null;
  infoAfter: Record<string, unknown> | null;
  imagesBefore: Record<string, unknown> | null;
  imagesAfter: Record<string, unknown> | null;
  createdImages: string[];
  deletedImages: [string, DeletedImageInfo][];
  materialsBefore: Record<string, unknown> | null;
  materialsAfter: Record<string, unknown> | null;
  createdMaterials: string[];
  deletedMaterials: [string, unknown][];
  soundsBefore: unknown[] | null;
  soundsAfter: unknown[] | null;
  createdSounds: string[];
  deletedSounds: [string, DeletedSoundInfo][];
  renderProbesBefore: Record<string, unknown> | null;
  renderProbesAfter: Record<string, unknown> | null;
  createdRenderProbes: string[];
  deletedRenderProbes: [string, unknown][];
  gameitemsListBefore: unknown[] | null;
  gameitemsListAfter: unknown[] | null;
  collectionsBefore: unknown[] | null;
  collectionsAfter: unknown[] | null;
  hiddenItemsBefore: string[] | null;
  hiddenItemsAfter: string[] | null;
  scriptBefore: string | null;
  scriptAfter: string | null;
}

export class UndoRecord {
  id: number;
  timestamp: number;
  description: string;
  snapshots: Map<string, SnapshotEntry>;
  createdItems: string[];
  deletedItems: Map<string, ItemSnapshot>;
  renamedItems: RenameEntry[];
  gamedataBefore: Record<string, unknown> | null;
  gamedataAfter: Record<string, unknown> | null;
  backglassViewMode: string | null;
  infoBefore: Record<string, unknown> | null;
  infoAfter: Record<string, unknown> | null;
  imagesBefore: Record<string, unknown> | null;
  imagesAfter: Record<string, unknown> | null;
  createdImages: string[];
  deletedImages: Map<string, DeletedImageInfo>;
  materialsBefore: Record<string, unknown> | null;
  materialsAfter: Record<string, unknown> | null;
  createdMaterials: string[];
  deletedMaterials: Map<string, unknown>;
  soundsBefore: unknown[] | null;
  soundsAfter: unknown[] | null;
  createdSounds: string[];
  deletedSounds: Map<string, DeletedSoundInfo>;
  renderProbesBefore: Record<string, unknown> | null;
  renderProbesAfter: Record<string, unknown> | null;
  createdRenderProbes: string[];
  deletedRenderProbes: Map<string, unknown>;
  gameitemsListBefore: unknown[] | null;
  gameitemsListAfter: unknown[] | null;
  collectionsBefore: unknown[] | null;
  collectionsAfter: unknown[] | null;
  hiddenItemsBefore: string[] | null;
  hiddenItemsAfter: string[] | null;
  scriptBefore: string | null;
  scriptAfter: string | null;

  constructor(description: string = '') {
    this.id = Date.now() + Math.random();
    this.timestamp = Date.now();
    this.description = description;

    this.snapshots = new Map();
    this.createdItems = [];
    this.deletedItems = new Map();
    this.renamedItems = [];

    this.gamedataBefore = null;
    this.gamedataAfter = null;
    this.backglassViewMode = null;

    this.infoBefore = null;
    this.infoAfter = null;

    this.imagesBefore = null;
    this.imagesAfter = null;
    this.createdImages = [];
    this.deletedImages = new Map();

    this.materialsBefore = null;
    this.materialsAfter = null;
    this.createdMaterials = [];
    this.deletedMaterials = new Map();

    this.soundsBefore = null;
    this.soundsAfter = null;
    this.createdSounds = [];
    this.deletedSounds = new Map();

    this.renderProbesBefore = null;
    this.renderProbesAfter = null;
    this.createdRenderProbes = [];
    this.deletedRenderProbes = new Map();

    this.gameitemsListBefore = null;
    this.gameitemsListAfter = null;

    this.collectionsBefore = null;
    this.collectionsAfter = null;

    this.hiddenItemsBefore = null;
    this.hiddenItemsAfter = null;

    this.scriptBefore = null;
    this.scriptAfter = null;
  }

  hasChanges(): boolean {
    return (
      this.snapshots.size > 0 ||
      this.createdItems.length > 0 ||
      this.deletedItems.size > 0 ||
      this.renamedItems.length > 0 ||
      this.gamedataBefore !== null ||
      this.infoBefore !== null ||
      this.imagesBefore !== null ||
      this.createdImages.length > 0 ||
      this.deletedImages.size > 0 ||
      this.materialsBefore !== null ||
      this.createdMaterials.length > 0 ||
      this.deletedMaterials.size > 0 ||
      this.soundsBefore !== null ||
      this.createdSounds.length > 0 ||
      this.deletedSounds.size > 0 ||
      this.renderProbesBefore !== null ||
      this.createdRenderProbes.length > 0 ||
      this.deletedRenderProbes.size > 0 ||
      this.gameitemsListBefore !== null ||
      this.collectionsBefore !== null ||
      this.hiddenItemsBefore !== null ||
      this.scriptBefore !== null
    );
  }

  toJSON(): UndoRecordJSON {
    return {
      id: this.id,
      timestamp: this.timestamp,
      description: this.description,
      snapshots: Array.from(this.snapshots.entries()),
      createdItems: this.createdItems,
      deletedItems: Array.from(this.deletedItems.entries()),
      renamedItems: this.renamedItems,
      gamedataBefore: this.gamedataBefore,
      gamedataAfter: this.gamedataAfter,
      backglassViewMode: this.backglassViewMode,
      infoBefore: this.infoBefore,
      infoAfter: this.infoAfter,
      imagesBefore: this.imagesBefore,
      imagesAfter: this.imagesAfter,
      createdImages: this.createdImages,
      deletedImages: Array.from(this.deletedImages.entries()),
      materialsBefore: this.materialsBefore,
      materialsAfter: this.materialsAfter,
      createdMaterials: this.createdMaterials,
      deletedMaterials: Array.from(this.deletedMaterials.entries()),
      soundsBefore: this.soundsBefore,
      soundsAfter: this.soundsAfter,
      createdSounds: this.createdSounds,
      deletedSounds: Array.from(this.deletedSounds.entries()),
      renderProbesBefore: this.renderProbesBefore,
      renderProbesAfter: this.renderProbesAfter,
      createdRenderProbes: this.createdRenderProbes,
      deletedRenderProbes: Array.from(this.deletedRenderProbes.entries()),
      gameitemsListBefore: this.gameitemsListBefore,
      gameitemsListAfter: this.gameitemsListAfter,
      collectionsBefore: this.collectionsBefore,
      collectionsAfter: this.collectionsAfter,
      hiddenItemsBefore: this.hiddenItemsBefore,
      hiddenItemsAfter: this.hiddenItemsAfter,
      scriptBefore: this.scriptBefore,
      scriptAfter: this.scriptAfter,
    };
  }

  static fromJSON(json: UndoRecordJSON): UndoRecord {
    const record = new UndoRecord(json.description);
    record.id = json.id;
    record.timestamp = json.timestamp;
    record.snapshots = new Map(json.snapshots);
    record.createdItems = json.createdItems;
    record.deletedItems = new Map(json.deletedItems);
    record.renamedItems = json.renamedItems;
    record.gamedataBefore = json.gamedataBefore;
    record.gamedataAfter = json.gamedataAfter;
    record.backglassViewMode = json.backglassViewMode;
    record.infoBefore = json.infoBefore;
    record.infoAfter = json.infoAfter;
    record.imagesBefore = json.imagesBefore;
    record.imagesAfter = json.imagesAfter;
    record.createdImages = json.createdImages;
    record.deletedImages = new Map(json.deletedImages);
    record.materialsBefore = json.materialsBefore;
    record.materialsAfter = json.materialsAfter;
    record.createdMaterials = json.createdMaterials;
    record.deletedMaterials = new Map(json.deletedMaterials);
    record.soundsBefore = json.soundsBefore;
    record.soundsAfter = json.soundsAfter;
    record.createdSounds = json.createdSounds || [];
    record.deletedSounds = new Map(json.deletedSounds || []);
    record.renderProbesBefore = json.renderProbesBefore;
    record.renderProbesAfter = json.renderProbesAfter;
    record.createdRenderProbes = json.createdRenderProbes || [];
    record.deletedRenderProbes = new Map(json.deletedRenderProbes || []);
    record.gameitemsListBefore = json.gameitemsListBefore;
    record.gameitemsListAfter = json.gameitemsListAfter;
    record.collectionsBefore = json.collectionsBefore;
    record.collectionsAfter = json.collectionsAfter;
    record.hiddenItemsBefore = json.hiddenItemsBefore;
    record.hiddenItemsAfter = json.hiddenItemsAfter;
    record.scriptBefore = json.scriptBefore;
    record.scriptAfter = json.scriptAfter;
    return record;
  }
}
