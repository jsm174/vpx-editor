import { state, elements, undoManager } from './state.js';
import { selectItem } from './items-panel.js';
import { showItemsPanelContextMenu, showPartGroupContextMenu } from './context-menu.js';
import { updatePropertiesPanel } from './properties-panel.js';
import { TreeControl } from './components/tree-control.js';
import { registerCallback, invokeCallback } from '../shared/callbacks.js';
import { getItemNameFromFileName } from './utils.js';

function showInfoModal(title, message) {
  const modal = document.getElementById('info-modal');
  const titleEl = document.getElementById('info-modal-title');
  const messageEl = document.getElementById('info-modal-message');
  const detailEl = document.getElementById('info-modal-detail');
  const okBtn = document.getElementById('info-modal-ok');

  titleEl.textContent = title;
  messageEl.textContent = message;
  detailEl.style.display = 'none';

  modal.classList.remove('hidden');

  const closeModal = () => {
    modal.classList.add('hidden');
    okBtn.removeEventListener('click', closeModal);
  };

  okBtn.addEventListener('click', closeModal);
}

registerCallback('renderCallback');
registerCallback('layerContextMenuCallbacks');
registerCallback('layerHeaderContextMenuCallbacks');
registerCallback('partGroupContextMenuCallbacks');

function triggerRender() {
  invokeCallback('renderCallback');
}

let treeControl = null;
let filterText = '';
let syncEnabled = false;

export function initPanelTabs() {
  document.getElementById('add-layer-btn')?.addEventListener('click', addPartGroup);
  document.getElementById('delete-layer-btn')?.addEventListener('click', deleteSelectedPartGroup);
  document.getElementById('assign-layer-btn')?.addEventListener('click', assignSelectedToGroup);
  document.getElementById('collapse-all-btn')?.addEventListener('click', collapseAll);
  document.getElementById('edit-group-btn')?.addEventListener('click', editGroupProperties);
  document.getElementById('sync-layer-btn')?.addEventListener('click', toggleSync);

  const filterInput = document.getElementById('layer-filter-input');
  filterInput?.addEventListener('input', e => {
    filterText = e.target.value;
    updateLayersList();
  });
}

export function getSelectedPartGroup() {
  return state.selectedPartGroup;
}

export function setSelectedPartGroup(groupName) {
  state.selectedPartGroup = groupName;
  state.primarySelectedItem = null;
  if (treeControl) {
    treeControl.setSelected(groupName === '_root' ? '_root' : `group:${groupName}`);
  }
  updateButtonStates();
}

function updateButtonStates() {
  const hasGroup = !!state.selectedPartGroup;
  const hasCanvasSelection = !!state.primarySelectedItem;

  const assignBtn = document.getElementById('assign-layer-btn');
  const deleteBtn = document.getElementById('delete-layer-btn');
  const editBtn = document.getElementById('edit-group-btn');

  if (assignBtn) assignBtn.disabled = !hasGroup || !hasCanvasSelection;
  if (deleteBtn) deleteBtn.disabled = !hasGroup;
  if (editBtn) editBtn.disabled = !hasGroup;
}

function assignSelectedToGroup() {
  if (!state.selectedPartGroup || !state.primarySelectedItem) return;

  const item = state.items[state.primarySelectedItem];
  if (!item || item._type === 'PartGroup') return;

  reassignItemToGroup(state.primarySelectedItem, state.selectedPartGroup);
}

function collapseAll() {
  if (treeControl) {
    treeControl.collapseAll();
    treeControl.expandedIds.add('_root');
    treeControl.render();
  }
}

function editGroupProperties() {
  if (!state.selectedPartGroup) return;
  updatePropertiesPanel();
}

function toggleSync() {
  syncEnabled = !syncEnabled;
  const btn = document.getElementById('sync-layer-btn');
  if (btn) {
    btn.classList.toggle('active', syncEnabled);
  }
  if (syncEnabled) {
    syncToSelection();
  }
}

function syncToSelection() {
  if (!state.primarySelectedItem || !treeControl) return;

  const item = state.items[state.primarySelectedItem];
  if (!item) return;

  if (item.part_group_name) {
    let groupName = item.part_group_name;
    while (groupName) {
      treeControl.expandedIds.add(`group:${groupName}`);
      const group = state.partGroups[groupName];
      groupName = group?.part_group_name;
    }
  }
  treeControl.expandedIds.add('_root');
  treeControl.setSelected(`item:${state.primarySelectedItem}`);
}

export function onCanvasSelectionChanged() {
  updateButtonStates();
  if (syncEnabled && state.primarySelectedItem) {
    syncToSelection();
  }
}

function matchesFilter(name) {
  if (!filterText) return true;
  return name.toLowerCase().includes(filterText.toLowerCase());
}

function getCheckState(items) {
  if (items.length === 0) return 'checked';
  const allHidden = items.every(({ item }) => item.editor_layer_visibility === false);
  const allVisible = items.every(({ item }) => item.editor_layer_visibility !== false);
  return allVisible ? 'checked' : allHidden ? 'unchecked' : 'mixed';
}

function buildTreeData() {
  const groups = {};
  const rootChildren = [];

  for (const [name, group] of Object.entries(state.partGroups)) {
    groups[name] = {
      name,
      group,
      children: [],
      items: [],
    };
  }

  for (const [name, group] of Object.entries(state.partGroups)) {
    const parentName = group.part_group_name;
    if (parentName && groups[parentName]) {
      groups[parentName].children.push(groups[name]);
    } else {
      rootChildren.push(groups[name]);
    }
  }

  for (const [itemName, item] of Object.entries(state.items)) {
    if (item._type === 'PartGroup') continue;
    if (!matchesFilter(itemName)) continue;
    const groupName = item.part_group_name ?? item._layerName;
    if (groupName && groups[groupName]) {
      groups[groupName].items.push({ name: itemName, item });
    } else {
      rootChildren.push({ name: itemName, item, isItem: true });
    }
  }

  rootChildren.sort((a, b) => {
    if (a.isItem && !b.isItem) return 1;
    if (!a.isItem && b.isItem) return -1;
    return a.name.localeCompare(b.name);
  });

  function convertGroup(groupData) {
    const allItems = getAllItemsInGroup(groupData);

    const children = [];

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

  const allItems = [];
  for (const [name, item] of Object.entries(state.items)) {
    if (item._type === 'PartGroup') continue;
    allItems.push({ name, item });
  }

  const rootNode = {
    id: '_root',
    label: 'Layers',
    icon: '<img src="icons/layers.png" width="16" height="16" class="layer-icon">',
    checkState: getCheckState(allItems),
    nodeType: 'root',
    allItems,
    children: rootChildren.map(child => {
      if (child.isItem) {
        return {
          id: `item:${child.name}`,
          label: child.name,
          icon: '<img src="icons/element.png" width="16" height="16" class="layer-icon">',
          checkState: child.item.editor_layer_visibility === false ? 'unchecked' : 'checked',
          showConnector: true,
          nodeType: 'item',
          itemName: child.name,
          item: child.item,
        };
      }
      return convertGroup(child);
    }),
  };

  return [rootNode];
}

function getAllItemsInGroup(groupData) {
  let items = [...groupData.items];
  for (const child of groupData.children) {
    items = items.concat(getAllItemsInGroup(child));
  }
  return items;
}

export function updateLayersList() {
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
  }

  treeControl.render();
}

function handleSelect(id, node) {
  if (node.nodeType === 'item') {
    state.selectedPartGroup = null;
    selectItem(node.itemName);
  } else if (node.nodeType === 'group') {
    state.selectedPartGroup = node.groupName;
    state.primarySelectedItem = null;
  } else if (node.nodeType === 'root') {
    state.selectedPartGroup = '_root';
    state.primarySelectedItem = null;
  }
  updateButtonStates();
  updatePropertiesPanel();
}

function handleToggleExpand(id, expanded) {}

async function handleToggleCheck(id, node) {
  if (node.nodeType === 'item') {
    await toggleItemVisibility(node.itemName);
  } else if (node.nodeType === 'group' || node.nodeType === 'root') {
    await toggleGroupVisibility(node.allItems);
  }
}

function handleContextMenu(e, id, node) {
  if (node.nodeType === 'item') {
    const callbacks = invokeCallback('layerContextMenuCallbacks');
    if (callbacks) {
      showItemsPanelContextMenu(e.clientX, e.clientY, node.itemName, callbacks);
    }
  } else if (node.nodeType === 'group') {
    const callbacks = invokeCallback('partGroupContextMenuCallbacks');
    if (callbacks) {
      showPartGroupContextMenu(e.clientX, e.clientY, node.groupName, callbacks);
    }
  }
}

function handleDragStart(e, id, node) {
  if (state.isTableLocked) {
    e.preventDefault();
    return;
  }
  if (node.nodeType === 'item') {
    e.dataTransfer.setData('text/plain', node.itemName);
    e.dataTransfer.setData('application/x-layer-item', node.itemName);
  } else if (node.nodeType === 'group') {
    e.dataTransfer.setData('text/plain', node.groupName);
    e.dataTransfer.setData('application/x-layer-group', node.groupName);
  }
  e.dataTransfer.effectAllowed = 'move';
}

async function handleDrop(e, targetId, targetNode) {
  if (state.isTableLocked) return;
  if (targetNode.nodeType !== 'group' && targetNode.nodeType !== 'root') return;

  const itemName = e.dataTransfer.getData('application/x-layer-item');
  const groupName = e.dataTransfer.getData('application/x-layer-group');

  const targetGroupName = targetNode.nodeType === 'root' ? null : targetNode.groupName;

  if (itemName) {
    await reassignItemToGroup(itemName, targetGroupName);
  } else if (groupName) {
    if (groupName !== targetGroupName && !isDescendantGroup(targetGroupName, groupName)) {
      await reassignGroupToGroup(groupName, targetGroupName);
    }
  }
}

async function toggleGroupVisibility(items) {
  const allHidden = items.every(({ item }) => item.editor_layer_visibility === false);
  const action = allHidden ? 'Show' : 'Hide';

  undoManager.beginUndo(`${action} layer items`);

  for (const { name, item } of items) {
    undoManager.markForUndo(name);
    item.editor_layer_visibility = allHidden ? null : false;
    await saveItemVisibility(item);
  }

  undoManager.endUndo();
  updateLayersList();
  triggerRender();
}

async function toggleItemVisibility(name) {
  const item = state.items[name];
  if (!item) return;

  const isHidden = item.editor_layer_visibility === false;
  const action = isHidden ? 'Show' : 'Hide';

  undoManager.beginUndo(`${action} ${name}`);
  undoManager.markForUndo(name);

  item.editor_layer_visibility = isHidden ? null : false;
  await saveItemVisibility(item);

  undoManager.endUndo();
  updateLayersList();
  triggerRender();
}

async function saveItemVisibility(item) {
  const fileName = item._fileName;
  if (!fileName) return;

  const saveData = { ...item };
  delete saveData._type;
  delete saveData._fileName;
  delete saveData._layer;

  const wrapper = {};
  wrapper[item._type] = saveData;

  await window.vpxEditor.writeFile(`${state.extractedDir}/${fileName}`, JSON.stringify(wrapper, null, 2));
}

async function reassignItemToGroup(itemName, groupName) {
  const item = state.items[itemName];
  if (!item || item._type === 'PartGroup') return;

  if (item.part_group_name === groupName) return;

  undoManager.beginUndo('Move item to group');
  undoManager.markForUndo(itemName);

  item.part_group_name = groupName;

  const fileName = item._fileName;
  if (fileName) {
    const saveData = { ...item };
    delete saveData._type;
    delete saveData._fileName;
    delete saveData._layer;

    const wrapper = {};
    wrapper[item._type] = saveData;

    await window.vpxEditor.writeFile(`${state.extractedDir}/${fileName}`, JSON.stringify(wrapper, null, 2));
  }

  undoManager.endUndo();

  if (groupName && treeControl) {
    treeControl.expandedIds.add(`group:${groupName}`);
  }
  updateLayersList();
  elements.statusBar.textContent = groupName ? `Moved ${itemName} to ${groupName}` : `Unassigned ${itemName}`;
}

function isDescendantGroup(parentName, childName) {
  if (!parentName) return false;
  let group = state.partGroups[parentName];
  while (group) {
    if (group.part_group_name === childName) return true;
    group = state.partGroups[group.part_group_name];
  }
  return false;
}

async function reassignGroupToGroup(groupName, newParentName) {
  const group = state.partGroups[groupName];
  if (!group) return;

  if (group.part_group_name === newParentName) return;

  undoManager.beginUndo('Move group');
  undoManager.markForUndo(groupName);

  group.part_group_name = newParentName;

  const fileName = group._fileName;
  if (fileName) {
    const saveData = { PartGroup: { ...group } };
    delete saveData.PartGroup._type;
    delete saveData.PartGroup._fileName;
    delete saveData.PartGroup._layer;
    saveData.PartGroup.is_locked = saveData.PartGroup.is_locked ?? false;

    await window.vpxEditor.writeFile(`${state.extractedDir}/${fileName}`, JSON.stringify(saveData, null, 2));
  }

  undoManager.endUndo();

  if (newParentName && treeControl) {
    treeControl.expandedIds.add(`group:${newParentName}`);
  }
  updateLayersList();
  elements.statusBar.textContent = newParentName
    ? `Moved group ${groupName} to ${newParentName}`
    : `Moved group ${groupName} to root`;
}

function isNameUnique(name) {
  if (state.items[name]) return false;
  if (state.gameitems?.some(gi => gi.file_name && getItemNameFromFileName(gi.file_name) === name)) return false;
  return true;
}

let addingGroup = false;

async function addPartGroup() {
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
    let name;
    do {
      const padded = suffix < 10 ? `00${suffix}` : suffix < 100 ? `0${suffix}` : `${suffix}`;
      name = `${baseName}${padded}`;
      suffix++;
    } while (!isNameUnique(name) && suffix < 1000);

    if (suffix >= 1000) {
      elements.statusBar.textContent = 'Cannot create group: too many groups';
      return;
    }

    console.log(`addPartGroup: Creating ${name}`);

    const newGroup = {
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

    const fileName = `PartGroup.${name}.json`;
    const filePath = `${state.extractedDir}/gameitems/${fileName}`;

    await window.vpxEditor.writeFile(filePath, JSON.stringify({ PartGroup: newGroup }, null, 2));

    newGroup._type = 'PartGroup';
    newGroup._fileName = `gameitems/${fileName}`;
    state.partGroups[name] = newGroup;
    state.items[name] = newGroup;

    state.gameitems.push({
      file_name: fileName,
      name: name,
      type_name: 'PartGroup',
    });

    await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));

    undoManager.beginUndo('Add group');
    undoManager.markForCreate(name);
    undoManager.endUndo();

    if (treeControl) {
      treeControl.expandedIds.add(`group:${name}`);
    }
    updateLayersList();
    elements.statusBar.textContent = `Created group "${name}"`;
  } catch (err) {
    console.error('Failed to add group:', err);
    elements.statusBar.textContent = `Failed to add group: ${err.message}`;
  } finally {
    addingGroup = false;
  }
}

async function deleteSelectedPartGroup() {
  if (!state.selectedPartGroup || state.selectedPartGroup === '_root') return;

  const groupName = state.selectedPartGroup;
  const group = state.partGroups[groupName];
  if (!group) return;

  const allGroups = Object.keys(state.partGroups);
  if (allGroups.length <= 1) {
    return;
  }

  const parentName = group.part_group_name;
  const siblingGroups = Object.entries(state.partGroups)
    .filter(([name, g]) => g.part_group_name === parentName && name !== groupName)
    .map(([name]) => name)
    .sort();

  const targetGroup = siblingGroups[0] || null;

  undoManager.beginUndo('Delete group');
  await deleteGroupAndMoveItems(groupName, targetGroup);
  await window.vpxEditor.writeFile(`${state.extractedDir}/gameitems.json`, JSON.stringify(state.gameitems, null, 2));
  undoManager.endUndo();

  state.selectedPartGroup = null;
  updateLayersList();
  updatePropertiesPanel();
  triggerRender();
}

async function deleteGroupAndMoveItems(groupName, targetGroup) {
  const group = state.partGroups[groupName];
  if (!group) return;

  const childGroups = Object.entries(state.partGroups)
    .filter(([_, g]) => g.part_group_name === groupName)
    .map(([name]) => name);

  for (const childName of childGroups) {
    await deleteGroupAndMoveItems(childName, targetGroup);
  }

  const itemsInGroup = Object.entries(state.items).filter(
    ([_, item]) => (item.part_group_name === groupName || item._layerName === groupName) && item._type !== 'PartGroup'
  );

  for (const [itemName, item] of itemsInGroup) {
    undoManager.markForUndo(itemName);
    item.part_group_name = targetGroup;
    item._layerName = targetGroup || null;
    const fileName = item._fileName;
    if (fileName) {
      const saveData = { ...item };
      delete saveData._type;
      delete saveData._fileName;
      delete saveData._layer;
      const wrapper = {};
      wrapper[item._type] = saveData;
      await window.vpxEditor.writeFile(`${state.extractedDir}/${fileName}`, JSON.stringify(wrapper, null, 2));
      const baseFileName = fileName.split('/').pop();
      const giEntry = state.gameitems.find(gi => gi.file_name === baseFileName);
      if (giEntry) {
        giEntry.editor_layer_name = targetGroup || '';
      }
    }
  }

  undoManager.markForDelete(groupName);
  const fileName = group._fileName;
  if (fileName) {
    await window.vpxEditor.deleteFile(`${state.extractedDir}/${fileName}`);
  }
  delete state.partGroups[groupName];
  delete state.items[groupName];
  const baseFileName = fileName ? fileName.split('/').pop() : `PartGroup.${groupName}.json`;
  state.gameitems = state.gameitems.filter(gi => gi.file_name !== baseFileName);
}

export function updateCollectionsList() {}
