import '../../index.css';
import { state, elements, initElements, undoManager, dragRect, isItemVisible, setSelection } from './state.js';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_FACTOR, VIEW_MODE_2D, VIEW_MODE_3D } from '../shared/constants.js';
import {
  updateZoomDisplay,
  toWorld,
  findItemsAtPoint,
  findNodeAtPoint,
  convertToUnit,
  getUnitSuffix,
  getItemBounds,
} from './utils.js';
import { updateItemsList, selectItem, updateItemStatusInfo, updateSelectionStatus } from './items-panel.js';
import { updatePropertiesPanel, renameObject, renameTable } from './properties-panel.js';
import { render, fitToView } from './canvas-renderer.js';
import { initPanelTabs, updateLayersList, updateCollectionsList, onCanvasSelectionChanged } from './layers-panel.js';
import {
  is3DInitialized,
  get3DRenderer,
  clearScene,
  stopAnimation,
  startAnimation,
  resetCamera,
  toggleWireframe,
  getZoom3D,
  setZoom3D,
  onZoomChange,
  invalidateItem,
  invalidateAllItems,
  focusOnPoint3D,
  focusOnBounds3D,
  enterPreviewMode,
  exitPreviewMode,
} from './canvas-renderer-3d.js';
import { setMaxTextureSize } from './texture-loader.js';
import { clearPrimitiveMeshCache } from './objects/primitive.js';
import { showNodeContextMenu, showObjectContextMenu, showCanvasContextMenu, hideContextMenu } from './context-menu.js';
import { deleteObject } from './object-factory.js';
import { copyItem, cutItem, pasteItem, hasClipboard, updateClipboardMenuState } from './clipboard.js';
import { getGroupedCollectionForItem, createCollectionFromSelection } from './collections.js';
import { setCallback } from '../shared/callbacks.js';
import {
  loadTable,
  loadBackdropImage,
  saveItemToFile,
  updateGameitemsJson,
  updateVRButtonVisibility,
} from './table-loader.js';
import { toggleNodeSmooth, deleteNode, toggleNodeSlingshot, addPointToObject, addNode } from './node-operations.js';
import {
  transformItemName,
  originalDragPoints,
  setTransformItemName,
  setOriginalDragPoints,
  backupDragPoints,
  restoreDragPoints,
  applyRotation,
  applyScale,
  applyTranslate,
  getObjectCenter,
  moveObjectOffset,
  flipObjectX,
  flipObjectY,
  rotateObject,
  scaleObject,
  translateObject,
} from './object-operations.js';
import {
  toggleItemLock,
  renameItem,
  assignItemToGroup,
  assignItemToSelectedLayer,
  drawItemInFront,
  drawItemInBack,
  getDrawingOrderItems,
  showRenamePartGroupModal,
  renamePartGroup,
  showDeletePartGroupModal,
  deleteGroupAndMoveItems,
} from './layer-operations.js';
import {
  initToolboxResize,
  initRightPanelResize,
  initLayersResize,
  savePanelSettings,
  loadPanelSettings,
} from './panel-resize.js';
import {
  elementCursors,
  objectTypeLabels,
  setUIEnabled,
  exitCreationMode,
  enterCreationMode,
  createObjectAtPosition,
  setMagnifyMode,
  initElementsToolbar,
  initToolboxTools,
  initScriptButton,
  initTooltips,
  getCreationModeSetTime,
} from './toolbar-init.js';
import {
  renderCurrentView,
  resizeCanvas,
  switchViewMode,
  updateElementToolbarForBackglassView,
  updateToolboxForTableLock,
  setupZoomButtons,
  setupToggleButtons,
  setupBackglassToggle,
  registerCallbacks,
  applyTheme,
} from './view-manager.js';
import {
  clearConsole,
  showConsole,
  hideConsole,
  appendConsoleLine,
  initConsole,
  consoleOutput,
} from './console-panel.js';

function updateStatusBarUnits() {
  if (elements.statusBlank && state.lastMousePosition) {
    if (state.unitConversion !== 2) {
      const x = convertToUnit(state.lastMousePosition.x);
      const y = convertToUnit(state.lastMousePosition.y);
      const suffix = getUnitSuffix();
      elements.statusBlank.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}${suffix}`;
    } else {
      elements.statusBlank.textContent = '';
    }
  }
  if (state.primarySelectedItem) {
    selectItem(state.primarySelectedItem, true);
  }
}

initElements();
initPanelTabs();

setCallback('renderCallback', renderCurrentView);
setCallback('primitiveRenderCallback', renderCurrentView);
setCallback('primitiveStatusCallback', updateItemStatusInfo);
setCallback('focusItemIn3D', focusOnPoint3D);
setCallback('focusBoundsIn3D', focusOnBounds3D);
setCallback('selectionChangeCallback', () => {
  updateClipboardMenuState();
  onCanvasSelectionChanged();
  window.vpxEditor.notifySelectionChanged(state.selectedItems);
});
setCallback('itemContextMenuCallbacks', {
  onToggleLock: toggleItemLock,
  onCopy: async itemName => {
    await copyItem(itemName);
    updateClipboardMenuState();
  },
  onPaste: async () => {
    if (await hasClipboard()) {
      const newNames = await pasteItem(false);
      if (newNames) {
        updateItemsList();
        setSelection(newNames, newNames[0]);
        updatePropertiesPanel();
        renderCurrentView();
      }
    }
  },
  onPasteAtOriginal: async () => {
    if (await hasClipboard()) {
      const newNames = await pasteItem(true);
      if (newNames) {
        updateItemsList();
        setSelection(newNames, newNames[0]);
        updatePropertiesPanel();
        renderCurrentView();
      }
    }
  },
  onDrawingOrderHit: () => {
    window.vpxEditor.sendDrawingOrderData({ mode: 'hit', items: getDrawingOrderItems('hit') });
  },
  onDrawingOrderSelect: () => {
    window.vpxEditor.sendDrawingOrderData({ mode: 'select', items: getDrawingOrderItems('select') });
  },
  onDrawInFront: drawItemInFront,
  onDrawInBack: drawItemInBack,
  onFlipX: itemName => flipObjectX(itemName, renderCurrentView),
  onFlipY: itemName => flipObjectY(itemName, renderCurrentView),
  onRotate: rotateObject,
  onScale: scaleObject,
  onTranslate: translateObject,
  onAssignToLayer: assignItemToGroup,
  onAssignToSelectedLayer: assignItemToSelectedLayer,
});
setCallback('layerContextMenuCallbacks', {
  onToggleLock: toggleItemLock,
  onCopy: async itemName => {
    await copyItem(itemName);
    updateClipboardMenuState();
  },
  onCut: async itemName => {
    await cutItem(itemName);
    selectItem(null);
    updateItemsList();
    updateLayersList();
    updatePropertiesPanel();
    renderCurrentView();
    updateClipboardMenuState();
  },
  onRename: renameItem,
  onDelete: async itemName => {
    await deleteObject(itemName);
    selectItem(null);
    updateItemsList();
    updateLayersList();
    updatePropertiesPanel();
    renderCurrentView();
  },
  onAssignToGroup: assignItemToGroup,
});

setCallback('partGroupContextMenuCallbacks', {
  onRename: showRenamePartGroupModal,
  onDelete: showDeletePartGroupModal,
});

state.renderCallback = renderCurrentView;

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const resizeObserver = new ResizeObserver(() => {
  resizeCanvas();
});
resizeObserver.observe(elements.container);

window.vpxEditor.onTableLoaded(async data => {
  state.extractedDir = data.extractedDir;
  state.tableName = data.tableName || null;
  state.isTableLocked = data.isTableLocked || false;
  undoManager.clear();
  await loadTable();
  setUIEnabled(true);
  updateElementToolbarForBackglassView();
  updateToolboxForTableLock();
  updateUndoRedoButtons();
  updateClipboardMenuState();
});

window.vpxEditor.onTableClosed?.(() => {
  state.extractedDir = null;
  state.tableName = null;
  state.isTableLocked = false;
  state.gameitems = [];
  state.gamedata = null;
  state.images = [];
  state.materials = [];
  state.sounds = [];
  state.collections = [];
  state.items = {};
  state.selectedItems = [];
  state.scriptEditorOpen = false;
  undoManager.clear();
  if (is3DInitialized()) {
    clearScene();
  }
  clearPrimitiveMeshCache();
  state.backdropImage = null;
  state.viewMode = VIEW_MODE_2D;
  state.backglassView = false;
  document.getElementById('tool-3d')?.classList.remove('active');
  document.getElementById('tool-script')?.classList.remove('active');
  document.getElementById('toggle-backglass')?.classList.remove('active');
  setUIEnabled(false);
  elements.itemsList.innerHTML = '';
  elements.layersList.innerHTML = '';
  const propsContent = document.getElementById('properties-content');
  if (propsContent) {
    propsContent.innerHTML = '<p class="placeholder">Select an item to view properties</p>';
  }
  const ctx = elements.canvas.getContext('2d');
  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  elements.statusBar.textContent = 'Ready';
  updateUndoRedoButtons();
  updateClipboardMenuState();
});

window.vpxEditor.onExtractedDirChanged?.(newDir => {
  console.log('Extracted dir changed:', state.extractedDir, '->', newDir);
  state.extractedDir = newDir;
});

window.vpxEditor.onTableLockChanged(isLocked => {
  state.isTableLocked = isLocked;
  updateToolboxForTableLock();
  updatePropertiesPanel();
  updateClipboardMenuState();
  renderCurrentView();
});

window.vpxEditor.onZoomIn(() => {
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    setZoom3D(ZOOM_FACTOR);
  } else {
    state.zoom = Math.min(MAX_ZOOM, state.zoom * ZOOM_FACTOR);
    updateZoomDisplay();
    render();
  }
});

window.vpxEditor.onZoomOut(() => {
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    setZoom3D(1 / ZOOM_FACTOR);
  } else {
    state.zoom = Math.max(MIN_ZOOM, state.zoom / ZOOM_FACTOR);
    updateZoomDisplay();
    render();
  }
});

onZoomChange(zoom => {
  elements.zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
});

window.vpxEditor.onStatus(message => {
  elements.statusBar.textContent = message;
});

window.vpxEditor.onLoading?.(data => {
  const overlay = document.getElementById('loading-overlay');
  if (data.show) {
    overlay?.classList.remove('hidden');
  } else {
    overlay?.classList.add('hidden');
  }
});

function zoomAtPoint(offsetX, offsetY, zoomFactor) {
  const oldZoom = state.zoom;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * zoomFactor));
  if (newZoom === oldZoom) return;
  state.zoom = newZoom;
  state.panX = offsetX - (offsetX - state.panX) * (state.zoom / oldZoom);
  state.panY = offsetY - (offsetY - state.panY) * (state.zoom / oldZoom);
  updateZoomDisplay();
  render();
}

elements.canvas.addEventListener('mousedown', e => {
  if (state.tool === 'magnify') {
    if (e.button === 0) {
      zoomAtPoint(e.offsetX, e.offsetY, 1.5);
    } else if (e.button === 2) {
      zoomAtPoint(e.offsetX, e.offsetY, 0.5);
    }
    return;
  }

  if (e.button === 2 && e.ctrlKey) {
    zoomAtPoint(e.offsetX, e.offsetY, 0.5);
    state.ctrlZoomHandled = true;
    return;
  }

  if (e.button === 1) {
    e.preventDefault();
    state.isDragging = true;
    state.dragStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
    document.getElementById('tool-select')?.classList.remove('active');
    document.getElementById('tool-magnify')?.classList.remove('active');
    document.getElementById('tool-pan')?.classList.add('active');
    document.querySelectorAll('.toolbox-btn').forEach(b => b.classList.remove('creating'));
    setCanvasCursor('grabbing');
    return;
  }

  if (e.button === 0) {
    hideContextMenu();

    if (e.ctrlKey) {
      zoomAtPoint(e.offsetX, e.offsetY, 1.5);
      state.ctrlZoomHandled = true;
      return;
    }

    if (state.tool !== 'magnify' && (state.tool === 'pan' || e.altKey)) {
      state.isDragging = true;
      state.dragStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
      setCanvasCursor('grabbing');
    } else if (state.creationMode && Date.now() - getCreationModeSetTime() > 100) {
      const world = toWorld(e.offsetX, e.offsetY);
      const typeToCreate = state.creationMode;
      state.creationMode = null;
      createObjectAtPosition(typeToCreate, world);
    } else {
      const world = toWorld(e.offsetX, e.offsetY);

      if (state.primarySelectedItem) {
        const item = state.items[state.primarySelectedItem];

        if (item && item.drag_points) {
          if (!item.is_locked && !state.isTableLocked && e.metaKey) {
            addNode(state.primarySelectedItem, world.x, world.y, e.shiftKey);
            return;
          }

          const nodeIndex = findNodeAtPoint(item, world.x, world.y);
          if (nodeIndex >= 0) {
            state.selectedNode = { itemName: state.primarySelectedItem, nodeIndex };
            if (!item.is_locked && !state.isTableLocked) {
              undoManager.beginUndo('Move control point');
              undoManager.markForUndo(state.primarySelectedItem);
              state.draggingNode = true;
              state.nodeMoved = false;
              state.dragStart = { x: world.x, y: world.y };
            }
            updatePropertiesPanel();
            render();
            return;
          }
        }
      }

      state.selectedNode = null;
      updatePropertiesPanel();

      const hits = findItemsAtPoint(state.items, world.x, world.y);

      if (hits.length === 0) {
        dragRect.active = true;
        dragRect.startX = dragRect.endX = world.x;
        dragRect.startY = dragRect.endY = world.y;
        if (!e.shiftKey) {
          selectItem(null, true);
        }
      } else {
        const clickedItem = hits[0];

        if (e.shiftKey) {
          if (state.selectedItems.includes(clickedItem)) {
            const newSelection = state.selectedItems.filter(n => n !== clickedItem);
            if (newSelection.length > 0) {
              setSelection(newSelection, newSelection[0]);
            } else {
              selectItem(null, true);
            }
          } else {
            const newSelection = [...state.selectedItems, clickedItem];
            setSelection(newSelection, clickedItem);
          }
          updatePropertiesPanel();
          render();
        } else {
          const hitInSelection = state.selectedItems.find(name => hits.includes(name));
          if (!hitInSelection) {
            selectItem(hits[0], true);
          }
          const anyUnlocked = state.selectedItems.some(name => !state.items[name]?.is_locked);
          if (anyUnlocked && !state.isTableLocked) {
            undoManager.beginUndo('Move object');
            for (const itemName of state.selectedItems) {
              if (!state.items[itemName]?.is_locked) {
                undoManager.markForUndo(itemName);
              }
            }
            state.draggingObject = true;
            state.objectMoved = false;
            state.objectDragStart = { x: world.x, y: world.y };
          }
        }
      }
    }
  }
});

elements.canvas.addEventListener('mousemove', e => {
  const world = toWorld(e.offsetX, e.offsetY);
  state.lastMousePosition = { x: world.x, y: world.y };

  if (state.gamedata) {
    if (elements.statusMouse) {
      elements.statusMouse.textContent = `${world.x.toFixed(4)}, ${world.y.toFixed(4)}`;
    }
    if (elements.statusBlank) {
      if (state.unitConversion !== 2) {
        const x = convertToUnit(world.x);
        const y = convertToUnit(world.y);
        const suffix = getUnitSuffix();
        elements.statusBlank.textContent = `${x.toFixed(2)}, ${y.toFixed(2)}${suffix}`;
      } else {
        elements.statusBlank.textContent = '';
      }
    }
  }

  if (dragRect.active) {
    dragRect.endX = world.x;
    dragRect.endY = world.y;
    render();
  } else if (state.isDragging) {
    state.panX = e.clientX - state.dragStart.x;
    state.panY = e.clientY - state.dragStart.y;
    render();
  } else if (state.draggingNode && state.selectedNode) {
    const item = state.items[state.selectedNode.itemName];
    if (item && item.drag_points) {
      const pt = item.drag_points[state.selectedNode.nodeIndex];
      if (pt.vertex) {
        pt.vertex.x = world.x;
        pt.vertex.y = world.y;
      } else {
        pt.x = world.x;
        pt.y = world.y;
      }
      state.nodeMoved = true;
      render();
      updatePropertiesPanel();
    }
  } else if (state.draggingObject && state.selectedItems.length > 0) {
    const dx = world.x - state.objectDragStart.x;
    const dy = world.y - state.objectDragStart.y;
    if (dx !== 0 || dy !== 0) {
      state.objectMoved = true;
      for (const itemName of state.selectedItems) {
        if (!state.items[itemName]?.is_locked) {
          moveObjectOffset(itemName, dx, dy);
        }
      }
      state.objectDragStart = { x: world.x, y: world.y };
      render();
      updatePropertiesPanel();
    }
  }
});

export { renderCurrentView, setCanvasCursor };

function getItemsInRect(rect) {
  const minX = Math.min(rect.startX, rect.endX);
  const maxX = Math.max(rect.startX, rect.endX);
  const minY = Math.min(rect.startY, rect.endY);
  const maxY = Math.max(rect.startY, rect.endY);

  const result = new Set();
  for (const [name, item] of Object.entries(state.items)) {
    if (!isItemVisible(item, name)) continue;
    const bounds = getItemBounds(item);
    if (bounds && isFinite(bounds.minX) && isFinite(bounds.maxX)) {
      if (bounds.minX >= minX && bounds.maxX <= maxX && bounds.minY >= minY && bounds.maxY <= maxY) {
        result.add(name);
        const collection = getGroupedCollectionForItem(name);
        if (collection) {
          for (const collectionItem of collection.items) {
            result.add(collectionItem);
          }
        }
      }
    }
  }
  return [...result];
}

elements.canvas.addEventListener('mouseup', e => {
  if (dragRect.active) {
    const itemsInBox = getItemsInRect(dragRect);
    if (itemsInBox.length > 0) {
      if (e.shiftKey) {
        const newSelection = [...new Set([...state.selectedItems, ...itemsInBox])];
        setSelection(newSelection, newSelection[0]);
      } else {
        setSelection(itemsInBox, itemsInBox[0]);
      }
      updatePropertiesPanel();
      updateClipboardMenuState();
    }
    dragRect.active = false;
    render();
  }
  if (state.draggingNode && state.selectedNode) {
    if (state.nodeMoved) {
      saveItemToFile(state.selectedNode.itemName);
      undoManager.endUndo();
      invalidateItem(state.selectedNode.itemName);
    } else {
      undoManager.cancelUndo();
    }
    state.draggingNode = false;
    state.nodeMoved = false;
  }
  if (state.draggingObject && state.selectedItems.length > 0) {
    if (state.objectMoved) {
      for (const itemName of state.selectedItems) {
        if (!state.items[itemName]?.is_locked) {
          saveItemToFile(itemName);
          invalidateItem(itemName);
        }
      }
      undoManager.endUndo();
    } else {
      undoManager.cancelUndo();
    }
    state.draggingObject = false;
    state.objectMoved = false;
  }
  state.isDragging = false;
  if (state.tool !== 'magnify' && (e.altKey || state.tool === 'pan')) {
    setCanvasCursor('grab');
  } else if (state.tool !== 'magnify' && e.ctrlKey) {
    setCanvasCursor("url('cursors/magnify.png') 0 0, zoom-in");
  } else if (e.button === 1) {
    document.getElementById('tool-pan')?.classList.remove('active');
    if (state.creationMode) {
      const btn = document.querySelector(`.toolbox-btn[data-type="${state.creationMode}"]`);
      if (btn) btn.classList.add('creating');
      const cursorFile = elementCursors[state.creationMode] || state.creationMode.toLowerCase();
      setCanvasCursor(`url('cursors/${cursorFile}.png') 0 0, crosshair`);
    } else if (state.tool === 'select') {
      document.getElementById('tool-select')?.classList.add('active');
      setCanvasCursor('default');
    } else if (state.tool === 'magnify') {
      document.getElementById('tool-magnify')?.classList.add('active');
      setCanvasCursor("url('cursors/magnify.png') 0 0, zoom-in");
    }
  } else if (state.creationMode) {
    const cursorFile = elementCursors[state.creationMode] || state.creationMode.toLowerCase();
    setCanvasCursor(`url('cursors/${cursorFile}.png') 0 0, crosshair`);
  } else {
    setCanvasCursor(getToolCursor());
  }
});

elements.canvas.addEventListener('contextmenu', e => {
  e.preventDefault();

  if (state.tool === 'magnify') {
    return;
  }

  if (state.ctrlZoomHandled) {
    state.ctrlZoomHandled = false;
    return;
  }

  if (state.primarySelectedItem) {
    const item = state.items[state.primarySelectedItem];
    if (item) {
      const world = toWorld(e.offsetX, e.offsetY);

      if (!item.is_locked && item.drag_points) {
        const nodeIndex = findNodeAtPoint(item, world.x, world.y);
        if (nodeIndex >= 0) {
          state.selectedNode = { itemName: state.primarySelectedItem, nodeIndex };
          showNodeContextMenu(e.clientX, e.clientY, state.primarySelectedItem, nodeIndex, {
            onToggleSmooth: toggleNodeSmooth,
            onToggleSlingshot: toggleNodeSlingshot,
            onDeleteNode: deleteNode,
          });
          updatePropertiesPanel();
          render();
          return;
        }
      }

      const allItemsAtPoint = findItemsAtPoint(state.items, world.x, world.y);
      showObjectContextMenu(
        e.clientX,
        e.clientY,
        state.primarySelectedItem,
        world.x,
        world.y,
        {
          onToggleLock: toggleItemLock,
          onCopy: async itemName => {
            await copyItem(itemName);
            updateClipboardMenuState();
          },
          onPaste: async (worldX, worldY) => {
            state.lastMousePosition = { x: worldX, y: worldY };
            const newNames = await pasteItem(false);
            if (newNames) {
              updateItemsList();
              setSelection(newNames, newNames[0]);
              updatePropertiesPanel();
              renderCurrentView();
            }
          },
          onPasteAtOriginal: async () => {
            const newNames = await pasteItem(true);
            if (newNames) {
              updateItemsList();
              setSelection(newNames, newNames[0]);
              updatePropertiesPanel();
              renderCurrentView();
            }
          },
          onDrawingOrderHit: () => {
            window.vpxEditor.sendDrawingOrderData({ mode: 'hit', items: getDrawingOrderItems('hit') });
          },
          onDrawingOrderSelect: () => {
            window.vpxEditor.sendDrawingOrderData({ mode: 'select', items: getDrawingOrderItems('select') });
          },
          onDrawInFront: drawItemInFront,
          onDrawInBack: drawItemInBack,
          onAddPoint: addPointToObject,
          onFlipX: itemName => flipObjectX(itemName, renderCurrentView),
          onFlipY: itemName => flipObjectY(itemName, renderCurrentView),
          onRotate: rotateObject,
          onScale: scaleObject,
          onTranslate: translateObject,
          onAssignToLayer: assignItemToGroup,
          onAssignToSelectedLayer: assignItemToSelectedLayer,
          onDelete: async () => {
            const itemsToDelete = state.selectedItems.filter(name => {
              const item = state.items[name];
              return item && !item.is_locked;
            });
            if (itemsToDelete.length === 0) return;
            undoManager.beginUndo(
              itemsToDelete.length > 1 ? `Delete ${itemsToDelete.length} items` : `Delete ${itemsToDelete[0]}`
            );
            for (const name of itemsToDelete) {
              await deleteObject(name, true);
            }
            undoManager.endUndo();
            selectItem(null);
            updateItemsList();
            updatePropertiesPanel();
            renderCurrentView();
          },
          onSelectElement: elementName => {
            selectItem(elementName, true);
            updatePropertiesPanel();
            renderCurrentView();
          },
        },
        allItemsAtPoint
      );
    }
  } else {
    const world = toWorld(e.offsetX, e.offsetY);
    showCanvasContextMenu(e.clientX, e.clientY, world.x, world.y, {
      onCreateElement: (type, worldX, worldY) => {
        createObjectAtPosition(type, { x: worldX, y: worldY });
      },
      onPaste: async (worldX, worldY) => {
        state.lastMousePosition = { x: worldX, y: worldY };
        const newNames = await pasteItem(false);
        if (newNames) {
          setSelection(newNames, newNames[0]);
          updateItemsList();
          updatePropertiesPanel();
          renderCurrentView();
        }
      },
      onPasteAtOriginal: async () => {
        const newNames = await pasteItem(true);
        if (newNames) {
          setSelection(newNames, newNames[0]);
          updateItemsList();
          updatePropertiesPanel();
          renderCurrentView();
        }
      },
    });
  }
});

elements.canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const oldZoom = state.zoom;
  state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * zoomFactor));

  const mouseX = e.offsetX;
  const mouseY = e.offsetY;
  state.panX = mouseX - (mouseX - state.panX) * (state.zoom / oldZoom);
  state.panY = mouseY - (mouseY - state.panY) * (state.zoom / oldZoom);

  updateZoomDisplay();
  render();
});

document.getElementById('btn-play').addEventListener('click', () => {
  window.vpxEditor.playTable();
});

window.vpxEditor.onPlayStarted?.(() => {
  document.getElementById('btn-play').disabled = true;
  document.getElementById('btn-play').classList.add('playing');
});

window.vpxEditor.onPlayStopped?.(() => {
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-play').classList.remove('playing');
});

document.getElementById('toggle-wireframe').addEventListener('click', () => {
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    const isWireframe = toggleWireframe();
    document.getElementById('toggle-wireframe').classList.toggle('active', isWireframe);
  }
});

document.getElementById('toggle-materials').addEventListener('click', () => {
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    state.showMaterials = !state.showMaterials;
    document.getElementById('toggle-materials').classList.toggle('active', state.showMaterials);
    clearScene();
    render3D();
    elements.statusBar.textContent = state.showMaterials ? 'Materials enabled' : 'Materials disabled';
  }
});

document.getElementById('tool-3d').addEventListener('click', () => {
  switchViewMode(state.viewMode === VIEW_MODE_3D ? VIEW_MODE_2D : VIEW_MODE_3D);
});

const vrModeToggle = document.getElementById('vr-mode-toggle');
vrModeToggle.addEventListener('click', () => {
  const isActive = vrModeToggle.classList.toggle('active');
  state.previewViewMode = isActive ? 'vr' : 'editor';
  if (isActive) {
    enterPreviewMode('vr');
  } else {
    exitPreviewMode();
  }
});

const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

function updateUndoRedoButtons() {
  const canUndo = undoManager.canUndo();
  const canRedo = undoManager.canRedo();
  undoBtn.disabled = !canUndo;
  redoBtn.disabled = !canRedo;
  undoBtn.dataset.tooltip = 'Undo';
  redoBtn.dataset.tooltip = 'Redo';
  window.vpxEditor.updateUndoState({ canUndo, canRedo });
}

undoManager.setOnChange(updateUndoRedoButtons);

undoBtn.addEventListener('click', async () => {
  const result = await undoManager.undo();
  if (result.success) {
    if (result.selectItems !== undefined) {
      if (result.selectItems.length > 0) {
        setSelection(result.selectItems, result.selectItems[0]);
      } else {
        selectItem(null, true);
      }
    }
    updatePropertiesPanel();
    updateItemsList();
    updateLayersList();
    updateCollectionsList();
    invalidateAllItems();
    renderCurrentView();
  }
});

redoBtn.addEventListener('click', async () => {
  const result = await undoManager.redo();
  if (result.success) {
    if (result.selectItems !== undefined) {
      if (result.selectItems.length > 0) {
        setSelection(result.selectItems, result.selectItems[0]);
      } else {
        selectItem(null, true);
      }
    }
    updatePropertiesPanel();
    updateItemsList();
    updateLayersList();
    updateCollectionsList();
    invalidateAllItems();
    renderCurrentView();
  }
});

document.addEventListener('keydown', async e => {
  if (e.target.tagName === 'INPUT') return;

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
    e.preventDefault();
    const result = await undoManager.undo();
    if (result.success) {
      if (result.selectItems !== undefined) {
        if (result.selectItems.length > 0) {
          setSelection(result.selectItems, result.selectItems[0]);
        } else {
          selectItem(null, true);
        }
      }
      updatePropertiesPanel();
      updateItemsList();
      updateLayersList();
      updateCollectionsList();
      invalidateAllItems();
      renderCurrentView();
    }
    return;
  }

  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
    e.preventDefault();
    const result = await undoManager.redo();
    if (result.success) {
      if (result.selectItems !== undefined) {
        if (result.selectItems.length > 0) {
          setSelection(result.selectItems, result.selectItems[0]);
        } else {
          selectItem(null, true);
        }
      }
      updatePropertiesPanel();
      updateItemsList();
      updateLayersList();
      updateCollectionsList();
      invalidateAllItems();
      renderCurrentView();
    }
    return;
  }

  const isConsoleFocused = document.activeElement === consoleOutput;

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'a' && isConsoleFocused) {
    e.preventDefault();
    const range = document.createRange();
    range.selectNodeContents(consoleOutput);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'c') {
    const selectedText = window.getSelection().toString();
    if (isConsoleFocused && selectedText) {
      e.preventDefault();
      navigator.clipboard.writeText(selectedText);
      return;
    }
    e.preventDefault();
    if (state.primarySelectedItem) {
      await copyItem(state.primarySelectedItem);
      updateClipboardMenuState();
    }
    return;
  }

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'x') {
    if (isConsoleFocused) return;
    e.preventDefault();
    if (state.primarySelectedItem && !state.isTableLocked) {
      const itemName = state.primarySelectedItem;
      await cutItem(itemName);
      selectItem(null);
      updateItemsList();
      updatePropertiesPanel();
      renderCurrentView();
      updateClipboardMenuState();
    }
    return;
  }

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'v') {
    if (isConsoleFocused) return;
    e.preventDefault();
    if ((await hasClipboard()) && !state.isTableLocked) {
      const newNames = await pasteItem(false);
      if (newNames) {
        updateItemsList();
        setSelection(newNames, newNames[0]);
        updatePropertiesPanel();
        renderCurrentView();
      }
    }
    return;
  }

  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'v') {
    e.preventDefault();
    if ((await hasClipboard()) && !state.isTableLocked) {
      const newNames = await pasteItem(true);
      if (newNames) {
        updateItemsList();
        setSelection(newNames, newNames[0]);
        updatePropertiesPanel();
        renderCurrentView();
      }
    }
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedNode && !state.isTableLocked) {
      deleteNode(state.selectedNode.itemName, state.selectedNode.nodeIndex);
      e.preventDefault();
      return;
    }
  }

  if (e.key === 'Escape') {
    hideContextMenu();
    if (state.creationMode) {
      exitCreationMode();
    } else if (state.selectedNode) {
      state.selectedNode = null;
      updatePropertiesPanel();
      render();
    }
    return;
  }

  if (e.key === 'Alt' && state.extractedDir && state.tool !== 'magnify' && state.viewMode !== VIEW_MODE_3D) {
    document.getElementById('tool-select')?.classList.remove('active');
    document.getElementById('tool-pan')?.classList.add('active');
    document.querySelectorAll('.toolbox-btn').forEach(b => b.classList.remove('creating'));
    setCanvasCursor('grab');
    return;
  }

  if (e.key === 'Control' && state.extractedDir && state.tool !== 'magnify' && state.viewMode !== VIEW_MODE_3D) {
    document.getElementById('tool-select')?.classList.remove('active');
    document.getElementById('tool-pan')?.classList.remove('active');
    document.getElementById('tool-magnify')?.classList.add('active');
    document.querySelectorAll('.toolbox-btn').forEach(b => b.classList.remove('creating'));
    setCanvasCursor("url('cursors/magnify.png') 0 0, zoom-in");
    return;
  }

  if (e.key === 'v' || e.key === 'V') {
    if (state.creationMode) {
      exitCreationMode();
    }
    state.tool = 'select';
    document.getElementById('tool-select')?.classList.add('active');
    document.getElementById('tool-pan')?.classList.remove('active');
    document.getElementById('tool-magnify')?.classList.remove('active');
    setCanvasCursor('default');
    return;
  }

  if (e.key === 'h' || e.key === 'H') {
    if (state.creationMode) {
      exitCreationMode();
    }
    state.tool = 'pan';
    document.getElementById('tool-pan')?.classList.add('active');
    document.getElementById('tool-select')?.classList.remove('active');
    document.getElementById('tool-magnify')?.classList.remove('active');
    setCanvasCursor('grab');
    return;
  }

  if (e.key === 'z' && !e.metaKey && !e.ctrlKey) {
    if (state.viewMode === VIEW_MODE_3D) return;
    if (state.tool === 'magnify') {
      setMagnifyMode(false);
    } else {
      setMagnifyMode(true);
    }
    return;
  }

  if (e.key === 'g' || e.key === 'G') {
    state.showGrid = !state.showGrid;
    document.getElementById('toggle-grid')?.classList.toggle('active', state.showGrid);
    renderCurrentView();
  }
  if (e.key === 'b' || e.key === 'B') {
    state.showBackdrop = !state.showBackdrop;
    document.getElementById('toggle-backdrop')?.classList.toggle('active', state.showBackdrop);
    renderCurrentView();
  }
  if (e.key === 'w' || e.key === 'W') {
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      const isWireframe = toggleWireframe();
      document.getElementById('toggle-wireframe').classList.toggle('active', isWireframe);
    }
  }
  if (e.key === 'Home') {
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      resetCamera();
      elements.zoomLevelEl.textContent = '100%';
    } else {
      fitToView();
    }
  }
});

document.addEventListener('keyup', e => {
  if (e.key === 'Alt' && state.extractedDir && state.tool !== 'magnify' && state.viewMode !== VIEW_MODE_3D) {
    document.getElementById('tool-pan')?.classList.remove('active');
    if (state.creationMode) {
      const btn = document.querySelector(`.toolbox-btn[data-type="${state.creationMode}"]`);
      if (btn) btn.classList.add('creating');
      const cursorFile = elementCursors[state.creationMode] || state.creationMode.toLowerCase();
      setCanvasCursor(`url('cursors/${cursorFile}.png') 0 0, crosshair`);
    } else if (state.tool === 'select') {
      document.getElementById('tool-select')?.classList.add('active');
      setCanvasCursor('default');
    } else if (state.tool === 'pan') {
      document.getElementById('tool-pan')?.classList.add('active');
      setCanvasCursor('grab');
    }
  }

  if (e.key === 'Control' && state.extractedDir && state.tool !== 'magnify' && state.viewMode !== VIEW_MODE_3D) {
    document.getElementById('tool-magnify')?.classList.remove('active');
    if (state.creationMode) {
      const btn = document.querySelector(`.toolbox-btn[data-type="${state.creationMode}"]`);
      if (btn) btn.classList.add('creating');
      const cursorFile = elementCursors[state.creationMode] || state.creationMode.toLowerCase();
      setCanvasCursor(`url('cursors/${cursorFile}.png') 0 0, crosshair`);
    } else if (state.tool === 'select') {
      document.getElementById('tool-select')?.classList.add('active');
      setCanvasCursor('default');
    } else if (state.tool === 'pan') {
      document.getElementById('tool-pan')?.classList.add('active');
      setCanvasCursor('grab');
    }
  }
});

function setCanvasCursor(cursor) {
  elements.canvas.style.cursor = cursor;
  if (is3DInitialized()) {
    get3DRenderer().domElement.style.cursor = cursor;
  }
}

function getToolCursor() {
  if (state.tool === 'magnify') return "url('cursors/magnify.png') 0 0, zoom-in";
  if (state.tool === 'pan') return 'grab';
  return 'default';
}

window.vpxEditor.onScriptEditorOpened?.(() => {
  state.scriptEditorOpen = true;
  document.getElementById('tool-script')?.classList.add('active');
});

window.vpxEditor.onScriptEditorClosed?.(() => {
  state.scriptEditorOpen = false;
  document.getElementById('tool-script')?.classList.remove('active');
});

initElementsToolbar();
initToolboxTools();
initScriptButton();
initToolboxResize(resizeCanvas);
initRightPanelResize(resizeCanvas);
initLayersResize();
initTooltips();
loadPanelSettings();
initTheme();
setUIEnabled(false);
setupZoomButtons();
setupToggleButtons();
setupBackglassToggle(selectItem);
registerCallbacks({ setMagnifyMode, exitCreationMode });
setTimeout(resizeCanvas, 0);

async function initTheme() {
  const theme = await window.vpxEditor.getTheme();
  applyTheme(theme);
}

window.vpxEditor.onSetTheme?.(theme => {
  applyTheme(theme);
});

window.vpxEditor.onSelectItem?.(itemName => {
  selectItem(itemName);
});

window.vpxEditor.onSelectItems?.(itemNames => {
  if (itemNames && itemNames.length > 0) {
    setSelection(itemNames, itemNames[0]);
    updateSelectionStatus();
    updatePropertiesPanel();
    render();
    onCanvasSelectionChanged();
    window.vpxEditor.notifySelectionChanged(state.selectedItems);
  }
});

window.vpxEditor.onRenameSubmitted?.(async data => {
  if (data.mode === 'table') {
    await renameTable(data.newName);
  } else {
    await renameObject(data.oldName, data.newName);
  }
});

window.vpxEditor.onRequestSelectionResend?.(() => {
  window.vpxEditor.notifySelectionChanged(state.selectedItems);
});

window.vpxEditor.onCollectionCreateFromSelectionRequest?.(async () => {
  if (state.selectedItems.length > 0) {
    await createCollectionFromSelection(state.selectedItems);
    updateCollectionsList();
  }
});

window.vpxEditor.onImagesChanged?.(async () => {
  const imagesResult = await window.vpxEditor.readFile(`${state.extractedDir}/images.json`);
  if (imagesResult.success) {
    const imagesArray = JSON.parse(imagesResult.content);
    state.images = {};
    for (const img of imagesArray) {
      state.images[img.name] = img;
    }
    state.imageNames = Object.keys(state.images).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    updatePropertiesPanel();
  }
});

window.vpxEditor.onMaterialsChanged?.(async () => {
  const materialsResult = await window.vpxEditor.readFile(`${state.extractedDir}/materials.json`);
  if (materialsResult.success) {
    const materialsArray = JSON.parse(materialsResult.content);
    state.materials = {};
    for (const mat of materialsArray) {
      state.materials[mat.name] = mat;
    }
    state.materialNames = Object.keys(state.materials).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    updatePropertiesPanel();
  }
});

window.vpxEditor.onSoundsChanged?.(async () => {
  const soundsResult = await window.vpxEditor.readFile(`${state.extractedDir}/sounds.json`);
  if (soundsResult.success) {
    state.sounds = JSON.parse(soundsResult.content);
    state.soundNames = state.sounds
      .map(s => s.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    updatePropertiesPanel();
  }
});

window.vpxEditor.onInfoChanged?.(info => {
  state.info = info;
});

window.vpxEditor.onGamedataChanged?.(gamedata => {
  state.gamedata = gamedata;
  updatePropertiesPanel();
});

window.vpxEditor.onGameitemsChanged?.(gameitems => {
  state.gameitems = gameitems;
  renderCurrentView();
});

window.vpxEditor.onUndo?.(async () => {
  const result = await undoManager.undo();
  if (result.success) {
    if (result.selectItems !== undefined) {
      if (result.selectItems.length > 0) {
        setSelection(result.selectItems, result.selectItems[0]);
      } else {
        selectItem(null, true);
      }
    }
    updatePropertiesPanel();
    updateItemsList();
    updateLayersList();
    updateCollectionsList();
    invalidateAllItems();
    renderCurrentView();
  }
});

window.vpxEditor.onRedo?.(async () => {
  const result = await undoManager.redo();
  if (result.success) {
    if (result.selectItems !== undefined) {
      if (result.selectItems.length > 0) {
        setSelection(result.selectItems, result.selectItems[0]);
      } else {
        selectItem(null, true);
      }
    }
    updatePropertiesPanel();
    updateItemsList();
    updateLayersList();
    updateCollectionsList();
    invalidateAllItems();
    renderCurrentView();
  }
});

function isEditableElementFocused() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

window.vpxEditor.onCut?.(async () => {
  if (isEditableElementFocused()) return;
  if (state.isTableLocked) return;
  if (state.primarySelectedItem) {
    const itemName = state.primarySelectedItem;
    await cutItem(itemName);
    selectItem(null);
    updateItemsList();
    updatePropertiesPanel();
    renderCurrentView();
  }
});

window.vpxEditor.onCopy?.(async () => {
  if (isEditableElementFocused()) return;
  if (state.primarySelectedItem) {
    await copyItem(state.primarySelectedItem);
    updateClipboardMenuState();
  }
});

window.vpxEditor.onPaste?.(async () => {
  if (isEditableElementFocused()) return;
  if (state.isTableLocked) return;
  if (await hasClipboard()) {
    const newNames = await pasteItem(false);
    if (newNames) {
      updateItemsList();
      setSelection(newNames, newNames[0]);
      updatePropertiesPanel();
      renderCurrentView();
    }
  }
});

window.vpxEditor.onPasteAtOriginal?.(async () => {
  if (isEditableElementFocused()) return;
  if (state.isTableLocked) return;
  if (await hasClipboard()) {
    const newNames = await pasteItem(true);
    if (newNames) {
      updateItemsList();
      setSelection(newNames, newNames[0]);
      updatePropertiesPanel();
      renderCurrentView();
    }
  }
});

window.vpxEditor.onToggleLock?.(() => {
  if (isEditableElementFocused()) return;
  if (state.isTableLocked) return;
  if (state.selectedItems.length === 0) return;

  for (const name of state.selectedItems) {
    toggleItemLock(name);
  }
});

window.vpxEditor.onDeleteSelected?.(async () => {
  if (isEditableElementFocused()) return;
  if (state.isTableLocked) return;
  if (state.selectedItems.length === 0) return;

  const itemsToDelete = state.selectedItems.filter(name => {
    const item = state.items[name];
    return item && !item.is_locked;
  });

  if (itemsToDelete.length === 0) return;

  undoManager.beginUndo(
    itemsToDelete.length > 1 ? `Delete ${itemsToDelete.length} items` : `Delete ${itemsToDelete[0]}`
  );
  for (const name of itemsToDelete) {
    await deleteObject(name, true);
  }
  undoManager.endUndo();

  selectItem(null);
  updateItemsList();
  updatePropertiesPanel();
  renderCurrentView();
});

window.vpxEditor.onSelectAll?.(() => {
  if (isEditableElementFocused()) return;
  insertItem('HitTarget');
});

window.vpxEditor.onUndoBegin?.(description => {
  undoManager.beginUndo(description);
});

window.vpxEditor.onUndoEnd?.(() => {
  undoManager.endUndo();
});

window.vpxEditor.onCollectionsUpdated?.(collections => {
  state.collections = collections;
  updateCollectionsList();
});

window.vpxEditor.onUndoCancel?.(() => {
  undoManager.cancelUndo();
});

window.vpxEditor.onMarkSavePoint?.(() => {
  undoManager.markSavePoint();
});

window.vpxEditor.onRecordScriptChange?.((before, after) => {
  undoManager.recordScriptChange(before, after);
});

window.vpxEditor.onUndoMarkImages?.(() => {
  undoManager.markImagesForUndo();
});

window.vpxEditor.onUndoMarkImageCreate?.(imageName => {
  undoManager.markImageForCreate(imageName);
});

window.vpxEditor.onUndoMarkImageDelete?.((imageName, imageData, filePath) => {
  undoManager.markImageForDelete(imageName, imageData, filePath);
});

window.vpxEditor.onUndoMarkMaterials?.(() => {
  undoManager.markMaterialsForUndo();
});

window.vpxEditor.onUndoMarkMaterialCreate?.(materialName => {
  undoManager.markMaterialForCreate(materialName);
});

window.vpxEditor.onUndoMarkMaterialDelete?.((materialName, materialData) => {
  undoManager.markMaterialForDelete(materialName, materialData);
});

window.vpxEditor.onUndoMarkRenderProbes?.(() => {
  undoManager.markRenderProbesForUndo();
});

window.vpxEditor.onUndoMarkRenderProbeCreate?.(probeName => {
  undoManager.markRenderProbeForCreate(probeName);
});

window.vpxEditor.onUndoMarkRenderProbeDelete?.((probeName, probeData) => {
  undoManager.markRenderProbeForDelete(probeName, probeData);
});

window.vpxEditor.onRenderProbesChanged?.(async () => {
  const renderProbesResult = await window.vpxEditor.readFile(`${state.extractedDir}/renderprobes.json`);
  if (renderProbesResult.success) {
    const renderProbesArray = JSON.parse(renderProbesResult.content);
    state.renderProbes = {};
    for (const probe of renderProbesArray) {
      state.renderProbes[probe.name] = probe;
    }
    state.renderProbeNames = Object.keys(state.renderProbes).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }
});

window.vpxEditor.onUndoMarkForUndo?.(itemName => {
  undoManager.markForUndo(itemName);
});

window.vpxEditor.onUndoMarkGamedata?.(() => {
  undoManager.markGamedataForUndo();
});

window.vpxEditor.onUndoMarkInfo?.(() => {
  undoManager.markInfoForUndo();
});

window.vpxEditor.onUndoMarkGameitemsList?.(() => {
  undoManager.markGameitemsListForUndo();
});

window.vpxEditor.getTextureQuality?.().then(quality => {
  if (quality !== undefined) {
    setMaxTextureSize(quality);
  }
});

window.vpxEditor.onTextureQualityChanged?.(quality => {
  setMaxTextureSize(quality);
  state.textureCache.clear();
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    clearScene();
    render3D();
  }
  elements.statusBar.textContent = quality === 0 ? 'Texture quality: Full' : `Texture quality: ${quality}px`;
});

window.vpxEditor.onViewSettingsChanged?.(settings => {
  state.viewSolid = settings.solid;
  state.viewOutline = settings.outline;
  state.showGrid = settings.grid;
  state.showBackdrop = settings.backdrop;
  document.getElementById('toggle-grid')?.classList.toggle('active', state.showGrid);
  document.getElementById('toggle-backdrop')?.classList.toggle('active', state.showBackdrop);
  renderCurrentView();
});

window.vpxEditor.onToggleBackglassView?.(enabled => {
  if (state.viewMode === VIEW_MODE_3D) return;
  state.backglassView = enabled;
  document.getElementById('toggle-backglass')?.classList.toggle('active', state.backglassView);
  const tool3dBtn = document.getElementById('tool-3d');
  if (tool3dBtn) {
    tool3dBtn.disabled = state.backglassView;
    tool3dBtn.style.opacity = state.backglassView ? '0.4' : '';
    tool3dBtn.style.pointerEvents = state.backglassView ? 'none' : '';
  }
  selectItem(null, true);
  updateElementToolbarForBackglassView();
  updateToolboxForTableLock();
  updateItemsList();
  updateLayersList();
  updatePropertiesPanel();
  fitToView();
});

window.vpxEditor.onToggleMagnify?.(() => {
  if (state.viewMode === VIEW_MODE_3D) return;
  setMagnifyMode(true);
});

window.vpxEditor.onGridSizeChanged?.(gridSize => {
  state.gridSize = gridSize;
  renderCurrentView();
});

window.vpxEditor.getGridSize?.().then(gridSize => {
  if (gridSize) {
    state.gridSize = gridSize;
  }
});

window.vpxEditor.getEditorSettings?.().then(settings => {
  if (settings) {
    if (settings.editorColors) {
      state.editorColors = { ...state.editorColors, ...settings.editorColors };
    }
    state.alwaysDrawDragPoints = settings.alwaysDrawDragPoints || false;
    state.drawLightCenters = settings.drawLightCenters || false;
    if (settings.unitConversion !== undefined) {
      state.unitConversion = settings.unitConversion;
    }
  }
});

window.vpxEditor.onEditorSettingsChanged?.(settings => {
  if (settings.editorColors) {
    state.editorColors = { ...state.editorColors, ...settings.editorColors };
  }
  state.alwaysDrawDragPoints = settings.alwaysDrawDragPoints || false;
  state.drawLightCenters = settings.drawLightCenters || false;
  if (settings.unitConversion !== undefined) {
    state.unitConversion = settings.unitConversion;
  }
  updateStatusBarUnits();
  renderCurrentView();
});

window.vpxEditor.onInsertItem?.(itemType => {
  if (!state.extractedDir) return;
  if (isEditableElementFocused()) return;
  if (state.viewMode === VIEW_MODE_3D) {
    switchViewMode(VIEW_MODE_2D);
  }
  enterCreationMode(itemType);
});

window.vpxEditor.onMeshImported?.(async data => {
  clearPrimitiveMeshCache();

  if (data.options?.importMaterial) {
    const materialsResult = await window.vpxEditor.readFile(`${state.extractedDir}/materials.json`);
    if (materialsResult.success) {
      const materialsArray = JSON.parse(materialsResult.content);
      state.materials = {};
      for (const mat of materialsArray) {
        state.materials[mat.name] = mat;
      }
      state.materialNames = Object.keys(state.materials).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
    }
  }

  if (state.primarySelectedItem) {
    const item = state.items[state.primarySelectedItem];
    if (item && item._fileName) {
      const itemResult = await window.vpxEditor.readFile(`${state.extractedDir}/${item._fileName}`);
      if (itemResult.success) {
        const itemData = JSON.parse(itemResult.content);
        const itemType = Object.keys(itemData)[0];
        const newData = itemData[itemType];
        Object.assign(item, newData);
      }
    }
  }

  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    invalidateItem(state.primarySelectedItem);
    render3D();
  } else {
    render();
  }

  updatePropertiesPanel();
  elements.statusBar.textContent = 'Mesh imported';
});

async function initViewSettings() {
  const settings = await window.vpxEditor.getViewSettings();
  if (settings) {
    state.viewSolid = settings.solid;
    state.viewOutline = settings.outline;
    state.showGrid = settings.grid;
    state.showBackdrop = settings.backdrop;
    document.getElementById('toggle-grid')?.classList.toggle('active', state.showGrid);
    document.getElementById('toggle-backdrop')?.classList.toggle('active', state.showBackdrop);
  }
}

initViewSettings();

document.addEventListener('mouseup', () => {
  if (state.isDragging) {
    state.isDragging = false;
    setCanvasCursor(getToolCursor());
  }
  if (state.draggingNode) {
    if (state.nodeMoved && state.selectedNode) {
      saveItemToFile(state.selectedNode.itemName);
      undoManager.endUndo();
      invalidateItem(state.selectedNode.itemName);
    } else {
      undoManager.cancelUndo();
    }
    state.draggingNode = false;
    state.nodeMoved = false;
  }
  if (state.draggingObject) {
    if (state.objectMoved && state.selectedItems.length > 0) {
      for (const itemName of state.selectedItems) {
        if (!state.items[itemName]?.is_locked) {
          saveItemToFile(itemName);
          invalidateItem(itemName);
        }
      }
      undoManager.endUndo();
    } else {
      undoManager.cancelUndo();
    }
    state.draggingObject = false;
    state.objectMoved = false;
  }
  state.ctrlZoomHandled = false;
});

window.vpxEditor.onRequestDrawingOrderData?.(mode => {
  window.vpxEditor.sendDrawingOrderData({ mode, items: getDrawingOrderItems(mode) });
});

initConsole();

window.vpxEditor.onApplyTransform?.(data => {
  const item = state.items[transformItemName];
  if (!item) return;

  restoreDragPoints(item, originalDragPoints);

  if (data.type === 'rotate') {
    applyRotation(item, data.angle, data.useOrigin, data.centerX, data.centerY);
  } else if (data.type === 'scale') {
    applyScale(item, data.scaleX, data.scaleY, data.useOrigin, data.centerX, data.centerY);
  } else if (data.type === 'translate') {
    applyTranslate(item, data.offsetX, data.offsetY);
  }

  invalidateItem(transformItemName);
  renderCurrentView();
});

window.vpxEditor.onUndoTransform?.(() => {
  const item = state.items[transformItemName];
  if (!item) return;

  restoreDragPoints(item, originalDragPoints);
  invalidateItem(transformItemName);
  renderCurrentView();
});

window.vpxEditor.onSaveTransform?.(data => {
  const item = state.items[transformItemName];
  if (!item) return;

  const currentTransform = backupDragPoints(item);
  restoreDragPoints(item, originalDragPoints);

  const typeName = data.type.charAt(0).toUpperCase() + data.type.slice(1);
  undoManager.beginUndo(typeName);
  undoManager.markForUndo(transformItemName);

  restoreDragPoints(item, currentTransform);
  saveItemToFile(transformItemName);
  undoManager.endUndo();

  invalidateItem(transformItemName);
  renderCurrentView();

  setTransformItemName(null);
  setOriginalDragPoints(null);
});

window.vpxEditor.onCancelTransform?.(() => {
  const item = state.items[transformItemName];
  if (!item) return;

  restoreDragPoints(item, originalDragPoints);
  invalidateItem(transformItemName);
  renderCurrentView();

  setTransformItemName(null);
  setOriginalDragPoints(null);
});

window.vpxEditor.onSetInputDisabled?.(disabled => {
  document.body.classList.toggle('input-disabled', disabled);
});
