import {
  state,
  elements,
  undoManager,
  GameItem,
  PartGroup,
  getItem,
  getPartGroup,
  setItem,
  setPartGroup,
  hasItem,
} from './state.js';
import { selectItem } from './items-panel.js';
import { showItemsPanelContextMenu, showPartGroupContextMenu } from './context-menu.js';
import { updatePropertiesPanel } from './properties-panel.js';
import { TreeControl, TreeNode as BaseTreeNode } from './components/tree-control.js';
import { registerCallback, invokeCallback, getCallback } from '../shared/callbacks.js';
import { generateUniqueFileName } from '../shared/gameitem-utils.js';
interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  checkState?: 'checked' | 'unchecked' | 'mixed';
  showConnector?: boolean;
  children?: TreeNode[];
  nodeType: 'root' | 'group' | 'item';
  itemName?: string;
  item?: GameItem;
  groupName?: string;
  group?: PartGroup;
  allItems?: ItemEntry[];
  suffix?: string;
}

interface ItemEntry {
  name: string;
  item: GameItem;
}

interface GroupData {
  name: string;
  group: PartGroup;
  children: GroupData[];
  items: ItemEntry[];
}

interface ContextMenuCallbacks {
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCopy?: () => void;
}

registerCallback('renderCallback');
registerCallback('layerContextMenuCallbacks');
registerCallback('layerHeaderContextMenuCallbacks');
registerCallback('partGroupContextMenuCallbacks');

function triggerRender(): void {
  invokeCallback('renderCallback');
}

let treeControl: TreeControl | null = null;
let filterText: string = '';

export function initPanelTabs(): void {
  document.getElementById('new-layer-btn')?.addEventListener('click', addPartGroup);

  const filterInput = document.getElementById('layer-filter-input') as HTMLInputElement | null;
  filterInput?.addEventListener('input', (e: Event) => {
    filterText = (e.target as HTMLInputElement).value;
    updateLayersList();
  });
}

export function getSelectedPartGroup(): string | null {
  return state.selectedPartGroup;
}

export function setSelectedPartGroup(groupName: string | null): void {
  state.selectedPartGroup = groupName;
  state.primarySelectedItem = null;
  if (treeControl) {
    treeControl.setSelected(groupName === '_root' ? '_root' : `group:${groupName}`);
  }
}

export function onCanvasSelectionChanged(): void {}

function matchesFilter(name: string): boolean {
  if (!filterText) return true;
  return name.toLowerCase().includes(filterText.toLowerCase());
}

function getCheckState(items: ItemEntry[]): 'checked' | 'unchecked' | 'mixed' {
  if (items.length === 0) return 'checked';
  const allHidden = items.every(({ item }) => item.editor_layer_visibility === false);
  const allVisible = items.every(({ item }) => item.editor_layer_visibility !== false);
  return allVisible ? 'checked' : allHidden ? 'unchecked' : 'mixed';
}

function buildTreeData(): TreeNode[] {
  const groups: Record<string, GroupData> = {};
  const rootChildren: (GroupData | { name: string; item: GameItem; isItem: true })[] = [];

  for (const [key, group] of Object.entries(state.partGroups)) {
    const displayName = group.name || key;
    groups[key] = {
      name: displayName,
      group,
      children: [],
      items: [],
    };
  }

  for (const [key, group] of Object.entries(state.partGroups)) {
    const parentName = group.part_group_name;
    const parentKey = parentName?.toLowerCase();
    if (parentKey && groups[parentKey]) {
      groups[parentKey].children.push(groups[key]);
    } else {
      rootChildren.push(groups[key]);
    }
  }

  for (const [itemKey, item] of Object.entries(state.items)) {
    if (item._type === 'PartGroup') continue;
    const displayName = item.name || itemKey;
    if (!matchesFilter(displayName)) continue;
    const groupName = item.part_group_name ?? (item as GameItem & { _layerName?: string })._layerName;
    const groupKey = groupName?.toLowerCase();
    if (groupKey && groups[groupKey]) {
      groups[groupKey].items.push({ name: displayName, item });
    } else {
      rootChildren.push({ name: displayName, item, isItem: true });
    }
  }

  rootChildren.sort((a, b) => {
    if ('isItem' in a && !('isItem' in b)) return 1;
    if (!('isItem' in a) && 'isItem' in b) return -1;
    return a.name.localeCompare(b.name);
  });

  function convertGroup(groupData: GroupData): TreeNode {
    const allItems = getAllItemsInGroup(groupData);

    const children: TreeNode[] = [];

    const sortedChildren = [...groupData.children].sort((a, b) => a.name.localeCompare(b.name));
    for (const child of sortedChildren) {
      children.push(convertGroup(child));
    }

    const sortedItems = [...groupData.items].sort((a, b) => a.name.localeCompare(b.name));
    for (const { name, item } of sortedItems) {
      children.push({
        id: `item:${name}`,
        label: name,
        icon: '<img src="icons/element.png" width="16" height="16" class="layer-icon">',
        checkState: item.editor_layer_visibility === false ? 'unchecked' : 'checked',
        showConnector: true,
        nodeType: 'item',
        itemName: name,
        item,
      });
    }

    return {
      id: `group:${groupData.name}`,
      label: groupData.name,
      icon: '<img src="icons/group.png" width="16" height="16" class="layer-icon">',
      checkState: getCheckState(allItems),
      showConnector: true,
      children: children.length > 0 ? children : undefined,
      nodeType: 'group',
      groupName: groupData.name,
      group: groupData.group,
      allItems,
    };
  }

  const allItems: ItemEntry[] = [];
  for (const [key, item] of Object.entries(state.items)) {
    if (item._type === 'PartGroup') continue;
    const displayName = item.name || key;
    allItems.push({ name: displayName, item });
  }

  const rootNode: TreeNode = {
    id: '_root',
    label: 'Layers',
    icon: '<img src="icons/layers.png" width="16" height="16" class="layer-icon">',
    checkState: getCheckState(allItems),
    nodeType: 'root',
    allItems,
    children: rootChildren.map(child => {
      if ('isItem' in child) {
        return {
          id: `item:${child.name}`,
          label: child.name,
          icon: '<img src="icons/element.png" width="16" height="16" class="layer-icon">',
          checkState: child.item.editor_layer_visibility === false ? 'unchecked' : 'checked',
          showConnector: true,
          nodeType: 'item' as const,
          itemName: child.name,
          item: child.item,
        };
      }
      return convertGroup(child);
    }),
  };

  return [rootNode];
}

function getAllItemsInGroup(groupData: GroupData): ItemEntry[] {
  let items = [...groupData.items];
  for (const child of groupData.children) {
    items = items.concat(getAllItemsInGroup(child));
  }
  return items;
}

export function updateLayersList(): void {
  if (!elements.layersList) return;

  if (!treeControl) {
    treeControl = new TreeControl(elements.layersList, {
      onSelect: handleSelect,
      onToggleExpand: handleToggleExpand,
      onToggleCheck: handleToggleCheck,
      onContextMenu: handleContextMenu,
      onDragStart: handleDragStart,
      onDrop: handleDrop,
    });
    treeControl.expandedIds.add('_root');
  }

  const treeData = buildTreeData();
  treeControl.nodes = treeData;

  if (state.primarySelectedItem) {
    treeControl.selectedId = `item:${state.primarySelectedItem}`;
  } else if (state.selectedPartGroup) {
    treeControl.selectedId = state.selectedPartGroup === '_root' ? '_root' : `group:${state.selectedPartGroup}`;
  } else {
    treeControl.selectedId = null;
  }

  treeControl.render();
}

function handleSelect(_id: string, baseNode: BaseTreeNode): void {
  const node = baseNode as TreeNode;
  if (node.nodeType === 'item') {
    state.selectedPartGroup = null;
    selectItem(node.itemName!);
  } else if (node.nodeType === 'group') {
    state.selectedPartGroup = node.groupName!;
    state.primarySelectedItem = null;
  } else if (node.nodeType === 'root') {
    state.selectedPartGroup = '_root';
    state.primarySelectedItem = null;
  }
  updatePropertiesPanel();
}

function handleToggleExpand(_id: string, _expanded: boolean): void {}

function handleToggleCheck(_id: string, baseNode: BaseTreeNode): void {
  const node = baseNode as TreeNode;
  if (node.nodeType === 'item') {
    toggleItemVisibility(node.itemName!);
  } else if (node.nodeType === 'group' || node.nodeType === 'root') {
    toggleGroupVisibility(node.allItems!);
  }
}

function handleContextMenu(e: MouseEvent, _id: string, baseNode: BaseTreeNode): void {
  const node = baseNode as TreeNode;
  if (node.nodeType === 'item') {
    const callbacks = getCallback<ContextMenuCallbacks>('layerContextMenuCallbacks');
    if (callbacks) {
      showItemsPanelContextMenu(e.clientX, e.clientY, node.itemName!, callbacks);
    }
  } else if (node.nodeType === 'group') {
    const callbacks = getCallback<ContextMenuCallbacks>('partGroupContextMenuCallbacks');
    if (callbacks) {
      showPartGroupContextMenu(e.clientX, e.clientY, node.groupName!, callbacks);
    }
  }
}

function handleDragStart(e: DragEvent, _id: string, baseNode: BaseTreeNode): void {
  const node = baseNode as TreeNode;
  if (state.isTableLocked) {
    e.preventDefault();
    return;
  }
  if (node.nodeType === 'item') {
    e.dataTransfer!.setData('text/plain', node.itemName!);
    e.dataTransfer!.setData('application/x-layer-item', node.itemName!);
  } else if (node.nodeType === 'group') {
    e.dataTransfer!.setData('text/plain', node.groupName!);
    e.dataTransfer!.setData('application/x-layer-group', node.groupName!);
  }
  e.dataTransfer!.effectAllowed = 'move';
}

function handleDrop(e: DragEvent, _targetId: string, baseNode: BaseTreeNode): void {
  const targetNode = baseNode as TreeNode;
  if (state.isTableLocked) return;
  if (targetNode.nodeType !== 'group' && targetNode.nodeType !== 'root') return;

  const itemName = e.dataTransfer!.getData('application/x-layer-item');
  const groupName = e.dataTransfer!.getData('application/x-layer-group');

  const targetGroupName = targetNode.nodeType === 'root' ? null : targetNode.groupName!;

  if (itemName) {
    reassignItemToGroup(itemName, targetGroupName);
  } else if (groupName) {
    if (groupName !== targetGroupName && !isDescendantGroup(targetGroupName, groupName)) {
      reassignGroupToGroup(groupName, targetGroupName);
    }
  }
}

async function toggleGroupVisibility(items: ItemEntry[]): Promise<void> {
  const allHidden = items.every(({ item }) => item.editor_layer_visibility === false);
  const action = allHidden ? 'Show' : 'Hide';

  undoManager.beginUndo(`${action} layer items`);

  for (const { name, item } of items) {
    undoManager.markForUndo(name);
    item.editor_layer_visibility = allHidden ? undefined : false;
    await saveItemVisibility(item);
  }

  undoManager.endUndo();
  updateLayersList();
  triggerRender();
}

async function toggleItemVisibility(name: string): Promise<void> {
  const item = getItem(name);
  if (!item) return;

  const isHidden = item.editor_layer_visibility === false;
  const action = isHidden ? 'Show' : 'Hide';

  undoManager.beginUndo(`${action} ${name}`);
  undoManager.markForUndo(name);

  item.editor_layer_visibility = isHidden ? undefined : false;
  await saveItemVisibility(item);

  undoManager.endUndo();
  updateLayersList();
  triggerRender();
}

async function saveItemVisibility(item: GameItem): Promise<void> {
  const fileName = item._fileName;
  if (!fileName) return;

  const saveData: Record<string, unknown> = { ...item };
  delete saveData._type;
  delete saveData._fileName;
  delete saveData._layer;

  const wrapper: Record<string, unknown> = {};
  wrapper[item._type] = saveData;

  await window.vpxEditor.writeFile(`${state.extractedDir}/${fileName}`, JSON.stringify(wrapper, null, 2));
}

async function reassignItemToGroup(itemName: string, groupName: string | null): Promise<void> {
  const item = getItem(itemName);
  if (!item || item._type === 'PartGroup') return;

  if (item.part_group_name === groupName) return;

  undoManager.beginUndo('Move item to group');
  undoManager.markForUndo(itemName);

  item.part_group_name = groupName ?? undefined;

  const fileName = item._fileName;
  if (fileName) {
    const saveData: Record<string, unknown> = { ...item };
    delete saveData._type;
    delete saveData._fileName;
    delete saveData._layer;

    const wrapper: Record<string, unknown> = {};
    wrapper[item._type] = saveData;

    await window.vpxEditor.writeFile(`${state.extractedDir}/${fileName}`, JSON.stringify(wrapper, null, 2));
  }

  undoManager.endUndo();

  if (groupName && treeControl) {
    treeControl.expandedIds.add(`group:${groupName}`);
  }
  updateLayersList();
  elements.statusBar!.textContent = groupName ? `Moved ${itemName} to ${groupName}` : `Unassigned ${itemName}`;
}

function isDescendantGroup(parentName: string | null, childName: string): boolean {
  if (!parentName) return false;
  let group: PartGroup | undefined = getPartGroup(parentName);
  while (group) {
    if (group.part_group_name === childName) return true;
    group = group.part_group_name ? getPartGroup(group.part_group_name) : undefined;
  }
  return false;
}

async function reassignGroupToGroup(groupName: string, newParentName: string | null): Promise<void> {
  const group = getPartGroup(groupName);
  if (!group) return;

  if (group.part_group_name === newParentName) return;

  undoManager.beginUndo('Move group');
  undoManager.markForUndo(groupName);

  group.part_group_name = newParentName ?? undefined;

  const fileName = group._fileName;
  if (fileName) {
    const saveData: Record<string, unknown> = { PartGroup: { ...group } };
    delete (saveData.PartGroup as Record<string, unknown>)._type;
    delete (saveData.PartGroup as Record<string, unknown>)._fileName;
    delete (saveData.PartGroup as Record<string, unknown>)._layer;
    (saveData.PartGroup as Record<string, unknown>).is_locked =
      (saveData.PartGroup as Record<string, unknown>).is_locked ?? false;

    await window.vpxEditor.writeFile(`${state.extractedDir}/${fileName}`, JSON.stringify(saveData, null, 2));
  }

  undoManager.endUndo();

  if (newParentName && treeControl) {
    treeControl.expandedIds.add(`group:${newParentName}`);
  }
  updateLayersList();
  elements.statusBar!.textContent = newParentName
    ? `Moved group ${groupName} to ${newParentName}`
    : `Moved group ${groupName} to root`;
}

function isNameUnique(name: string): boolean {
  return !hasItem(name);
}

let addingGroup: boolean = false;

async function addPartGroup(): Promise<void> {
  if (addingGroup) {
    console.log('addPartGroup: Already adding a group');
    return;
  }

  if (!state.extractedDir) {
    console.error('addPartGroup: No table loaded');
    return;
  }

  addingGroup = true;
  try {
    const baseName = 'Group';
    let suffix = 1;
    let name: string;
    do {
      const padded = suffix < 10 ? `00${suffix}` : suffix < 100 ? `0${suffix}` : `${suffix}`;
      name = `${baseName}${padded}`;
      suffix++;
    } while (!isNameUnique(name) && suffix < 1000);

    if (suffix >= 1000) {
      elements.statusBar!.textContent = 'Cannot create group: too many groups';
      return;
    }

    console.log(`addPartGroup: Creating ${name}`);

    const newGroup: Record<string, unknown> = {
      name,
      center: { x: 0, y: 0 },
      is_timer_enabled: false,
      timer_interval: 100,
      backglass: false,
      visibility_mask: null,
      space_reference: 'inherit',
      player_mode_visibility_mask: 0xffff,
      is_locked: false,
      editor_layer_name: null,
      editor_layer_visibility: false,
    };

    const existingFileNames = state.gameitems.map(gi => gi.file_name);
    const fileName = generateUniqueFileName('PartGroup', name, existingFileNames);
    const filePath = `${state.extractedDir}/gameitems/${fileName}`;

    await window.vpxEditor.writeFile(filePath, JSON.stringify({ PartGroup: newGroup }, null, 2));

    const partGroup = newGroup as unknown as PartGroup;
    partGroup._type = 'PartGroup';
    partGroup._fileName = `gameitems/${fileName}`;
    setPartGroup(name, partGroup);
    setItem(name, partGroup, fileName);

    state.gameitems.push({
      file_name: fileName,
      editor_layer_name: name,
    });

    await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));

    undoManager.beginUndo('Add group');
    undoManager.markForCreate(name);
    undoManager.endUndo();

    if (treeControl) {
      treeControl.expandedIds.add(`group:${name}`);
    }
    updateLayersList();
    elements.statusBar!.textContent = `Created group "${name}"`;
  } catch (err: unknown) {
    console.error('Failed to add group:', err);
    elements.statusBar!.textContent = `Failed to add group: ${(err as Error).message}`;
  } finally {
    addingGroup = false;
  }
}

export function updateCollectionsList(): void {}
