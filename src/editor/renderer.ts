import '../../index.css';
import { state, elements, initElements, undoManager, dragRect, isItemVisible, setSelection, getItem } from './state.js';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_FACTOR,
  VIEW_MODE_2D,
  VIEW_MODE_3D,
  UNIT_CONVERSION_VPU,
} from '../shared/constants.js';
import { includesName, nameEquals } from '../shared/gameitem-utils.js';
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
  clearScene,
  resetCamera,
  toggleWireframe,
  setZoom3D,
  onZoomChange,
  invalidateItem,
  invalidateAllItems,
  focusOnPoint3D,
  focusOnBounds3D,
  enterPreviewMode,
  render3D,
  get3DRenderer,
  stopAnimation,
  disable3DKeyboard,
} from './canvas-renderer-3d.js';
import { setMaxTextureSize } from './texture-loader.js';
import { clearPrimitiveMeshCache } from './parts/primitive.js';
import { showNodeContextMenu, showObjectContextMenu, showCanvasContextMenu, hideContextMenu } from './context-menu.js';
import { deleteObject } from './object-factory.js';
import { copyItem, cutItem, pasteItem, hasClipboard, updateClipboardMenuState } from './clipboard.js';
import {
  getGroupedCollectionForItem,
  createCollectionFromSelection,
  deleteCollectionWithConfirm,
} from './collections.js';
import { setCallback, invokeCallback } from '../shared/callbacks.js';
import { addLongPressContextMenu } from '../shared/long-press.js';
import { setCanvasCursor } from './cursor-utils.js';
import { loadTable, saveItemToFile } from './table-loader.js';
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
  drawItemInFront,
  drawItemInBack,
  getDrawingOrderItems,
  showRenamePartGroupModal,
  showDeletePartGroupModal,
  renamePartGroup,
} from './layer-operations.js';
import { initToolboxResize, initRightPanelResize, initLayersResize, loadPanelSettings } from './panel-resize.js';
import {
  elementCursors,
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
  applyTheme,
} from './view-manager.js';
import { initConsole, consoleOutput } from './console-panel.js';

function updateStatusBarUnits(): void {
  if (elements.statusBlank && state.gamedata && state.lastMousePosition) {
    if (state.unitConversion !== UNIT_CONVERSION_VPU) {
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

async function deleteItemAndRefresh(itemName: string): Promise<void> {
  await deleteObject(itemName);
  selectItem(null);
  updateItemsList();
  updateLayersList();
  updatePropertiesPanel();
  renderCurrentView();
}

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
  onCopy: async (itemName: string) => {
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
    window.vpxEditor.sendDrawingOrderData({
      mode: 'hit',
      items: getDrawingOrderItems('hit'),
    });
  },
  onDrawingOrderSelect: () => {
    window.vpxEditor.sendDrawingOrderData({
      mode: 'select',
      items: getDrawingOrderItems('select'),
    });
  },
  onDrawInFront: drawItemInFront,
  onDrawInBack: drawItemInBack,
  onFlipX: (itemName: string) => flipObjectX(itemName, renderCurrentView),
  onFlipY: (itemName: string) => flipObjectY(itemName, renderCurrentView),
  onRotate: rotateObject,
  onScale: scaleObject,
  onTranslate: translateObject,
  onAssignToLayer: assignItemToGroup,
  onDelete: deleteItemAndRefresh,
});
setCallback('layerContextMenuCallbacks', {
  onToggleLock: toggleItemLock,
  onCopy: async (itemName: string) => {
    await copyItem(itemName);
    updateClipboardMenuState();
  },
  onCut: async (itemName: string) => {
    await cutItem(itemName);
    selectItem(null);
    updateItemsList();
    updateLayersList();
    updatePropertiesPanel();
    renderCurrentView();
    updateClipboardMenuState();
  },
  onRename: renameItem,
  onDelete: deleteItemAndRefresh,
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
if (elements.container) {
  resizeObserver.observe(elements.container);
}

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
  state.images = {};
  state.materials = {};
  state.sounds = [];
  state.collections = [];
  state.items = {};
  state.selectedItems = [];
  state.scriptEditorOpen = false;
  undoManager.clear();
  if (is3DInitialized()) {
    disable3DKeyboard();
    stopAnimation();
    clearScene();
    get3DRenderer().domElement.style.display = 'none';
  }
  clearPrimitiveMeshCache();
  state.backdropImage = null;
  state.viewMode = VIEW_MODE_2D;
  state.backglassView = false;
  document.getElementById('tool-3d')?.classList.remove('active');
  document.getElementById('tool-script')?.classList.remove('active');
  document.getElementById('toggle-backglass')?.classList.remove('active');
  document.getElementById('toggle-wireframe')!.style.display = 'none';
  document.getElementById('toggle-materials')!.style.display = 'none';
  setUIEnabled(false);
  if (elements.itemsList) {
    elements.itemsList.innerHTML = '';
  }
  if (elements.layersList) {
    elements.layersList.innerHTML = '';
  }
  const propsContent = document.getElementById('properties-content');
  if (propsContent) {
    propsContent.innerHTML = '<p class="placeholder">Select an item to view properties</p>';
  }
  if (elements.canvas) {
    elements.canvas.style.display = 'block';
    const ctx = elements.canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    }
  }
  if (elements.statusBar) {
    elements.statusBar.textContent = 'Ready';
  }
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
  if (elements.zoomLevelEl) {
    elements.zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
  }
});

window.vpxEditor.onStatus(message => {
  if (elements.statusBar) {
    elements.statusBar.textContent = message;
  }
});

window.vpxEditor.onLoading?.(data => {
  const overlay = document.getElementById('loading-overlay');
  if (data.show) {
    overlay?.classList.remove('hidden');
  } else {
    overlay?.classList.add('hidden');
  }
});

function zoomAtPoint(offsetX: number, offsetY: number, zoomFactor: number): void {
  const oldZoom = state.zoom;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * zoomFactor));
  if (newZoom === oldZoom) return;
  state.zoom = newZoom;
  state.panX = offsetX - (offsetX - state.panX) * (state.zoom / oldZoom);
  state.panY = offsetY - (offsetY - state.panY) * (state.zoom / oldZoom);
  updateZoomDisplay();
  render();
}

addLongPressContextMenu(elements.canvas!);

elements.canvas!.addEventListener('pointerdown', e => {
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
    elements.canvas!.setPointerCapture(e.pointerId);
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
      elements.canvas!.setPointerCapture(e.pointerId);
    } else if (state.creationMode && Date.now() - getCreationModeSetTime() > 100) {
      const world = toWorld(e.offsetX, e.offsetY);
      const typeToCreate = state.creationMode;
      state.creationMode = null;
      createObjectAtPosition(typeToCreate, world);
    } else {
      const world = toWorld(e.offsetX, e.offsetY);

      if (state.primarySelectedItem) {
        const item = getItem(state.primarySelectedItem!);

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
              elements.canvas!.setPointerCapture(e.pointerId);
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
        elements.canvas!.setPointerCapture(e.pointerId);
      } else {
        const clickedItem = hits[0];

        if (e.shiftKey) {
          if (includesName(state.selectedItems, clickedItem)) {
            const newSelection = state.selectedItems.filter(n => !nameEquals(n, clickedItem));
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
          invokeCallback('selectionChangeCallback');
        } else {
          const hitInSelection = state.selectedItems.find(name => includesName(hits, name));
          if (!hitInSelection) {
            selectItem(hits[0], true);
          }
          const anyUnlocked = state.selectedItems.some(name => !getItem(name)?.is_locked);
          if (anyUnlocked && !state.isTableLocked) {
            undoManager.beginUndo('Move object');
            for (const itemName of state.selectedItems) {
              if (!getItem(itemName)?.is_locked) {
                undoManager.markForUndo(itemName);
              }
            }
            state.draggingObject = true;
            state.objectMoved = false;
            state.objectDragStart = { x: world.x, y: world.y };
            elements.canvas!.setPointerCapture(e.pointerId);
          }
        }
      }
    }
  }
});

elements.canvas!.addEventListener('pointermove', e => {
  const world = toWorld(e.offsetX, e.offsetY);
  state.lastMousePosition = { x: world.x, y: world.y };

  if (state.gamedata) {
    if (elements.statusMouse) {
      elements.statusMouse.textContent = `${world.x.toFixed(4)}, ${world.y.toFixed(4)}`;
    }
    if (elements.statusBlank) {
      if (state.unitConversion !== UNIT_CONVERSION_VPU) {
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
    const item = getItem(state.selectedNode.itemName);
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
        if (!getItem(itemName)?.is_locked) {
          moveObjectOffset(itemName, dx, dy);
        }
      }
      state.objectDragStart = { x: world.x, y: world.y };
      render();
      updatePropertiesPanel();
    }
  }
});

export { renderCurrentView, resizeCanvas };
export { setCanvasCursor } from './cursor-utils.js';

interface DragRect {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  active: boolean;
}

function getItemsInRect(rect: DragRect): string[] {
  const minX = Math.min(rect.startX, rect.endX);
  const maxX = Math.max(rect.startX, rect.endX);
  const minY = Math.min(rect.startY, rect.endY);
  const maxY = Math.max(rect.startY, rect.endY);

  const result = new Set<string>();
  for (const [name, item] of Object.entries(state.items)) {
    if (!isItemVisible(item, name)) continue;
    const bounds = getItemBounds(item);
    if (bounds && isFinite(bounds.minX) && isFinite(bounds.maxX)) {
      if (bounds.minX >= minX && bounds.maxX <= maxX && bounds.minY >= minY && bounds.maxY <= maxY) {
        result.add(name);
        const collection = getGroupedCollectionForItem(name);
        if (collection && collection.items) {
          for (const collectionItem of collection.items) {
            result.add(collectionItem);
          }
        }
      }
    }
  }
  return [...result];
}

function handleCanvasPointerEnd(e: PointerEvent): void {
  elements.canvas!.releasePointerCapture(e.pointerId);
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
      invokeCallback('selectionChangeCallback');
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
        if (!getItem(itemName)?.is_locked) {
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
}
elements.canvas!.addEventListener('pointerup', handleCanvasPointerEnd);
elements.canvas!.addEventListener('pointercancel', handleCanvasPointerEnd);

elements.canvas!.addEventListener('contextmenu', e => {
  e.preventDefault();

  if (state.tool === 'magnify') {
    return;
  }

  if (state.ctrlZoomHandled) {
    state.ctrlZoomHandled = false;
    return;
  }

  if (state.primarySelectedItem) {
    const item = getItem(state.primarySelectedItem!);
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
            window.vpxEditor.sendDrawingOrderData({
              mode: 'hit',
              items: getDrawingOrderItems('hit'),
            });
          },
          onDrawingOrderSelect: () => {
            window.vpxEditor.sendDrawingOrderData({
              mode: 'select',
              items: getDrawingOrderItems('select'),
            });
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
          onDelete: async () => {
            const itemsToDelete = state.selectedItems.filter(name => {
              const item = getItem(name);
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
            updateLayersList();
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

elements.canvas!.addEventListener('wheel', e => {
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

document.getElementById('btn-play')?.addEventListener('click', () => {
  window.vpxEditor.playTable();
});

window.vpxEditor.onPlayStarted?.(() => {
  const btn = document.getElementById('btn-play') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.classList.add('playing');
  }
});

window.vpxEditor.onPlayStopped?.(() => {
  const btn = document.getElementById('btn-play') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('playing');
  }
});

window.vpxEditor.onExportBlueprint?.(async data => {
  const { exportBlueprintAndDownload } = await import('./blueprint-export.js');
  await exportBlueprintAndDownload(data.solid, data.isBackglass);
});

document.getElementById('toggle-wireframe')?.addEventListener('click', () => {
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    const isWireframe = toggleWireframe();
    document.getElementById('toggle-wireframe')?.classList.toggle('active', isWireframe);
  }
});

document.getElementById('toggle-materials')?.addEventListener('click', () => {
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    state.showMaterials = !state.showMaterials;
    document.getElementById('toggle-materials')?.classList.toggle('active', state.showMaterials);
    clearScene();
    render3D();
    if (elements.statusBar) {
      elements.statusBar.textContent = state.showMaterials ? 'Materials enabled' : 'Materials disabled';
    }
  }
});

document.getElementById('tool-3d')?.addEventListener('click', () => {
  switchViewMode(state.viewMode === VIEW_MODE_3D ? VIEW_MODE_2D : VIEW_MODE_3D);
});

const playModeSelect = document.getElementById('play-mode-select') as HTMLSelectElement | null;
playModeSelect?.addEventListener('change', () => {
  const mode = playModeSelect.value;
  state.previewViewMode = mode;
  enterPreviewMode(mode);
});

const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement | null;

function updateUndoRedoButtons(): void {
  const canUndo = undoManager.canUndo();
  const canRedo = undoManager.canRedo();
  if (undoBtn) {
    undoBtn.disabled = !canUndo;
    undoBtn.dataset.tooltip = 'Undo';
  }
  if (redoBtn) {
    redoBtn.disabled = !canRedo;
    redoBtn.dataset.tooltip = 'Redo';
  }
  window.vpxEditor.updateUndoState({ canUndo, canRedo });
}

undoManager.setOnChange(updateUndoRedoButtons);

undoBtn?.addEventListener('click', async () => {
  const result = await undoManager.undo();
  if (result && result.success) {
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
    if (result.imagesChanged) window.vpxEditor.refreshImageManager();
    if (result.materialsChanged) window.vpxEditor.refreshMaterialManager();
    if (result.soundsChanged) window.vpxEditor.refreshSoundManager();
  }
});

redoBtn?.addEventListener('click', async () => {
  const result = await undoManager.redo();
  if (result && result.success) {
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
    if (result.imagesChanged) window.vpxEditor.refreshImageManager();
    if (result.materialsChanged) window.vpxEditor.refreshMaterialManager();
    if (result.soundsChanged) window.vpxEditor.refreshSoundManager();
  }
});

document.addEventListener('keydown', async e => {
  const target = e.target as HTMLElement | null;
  if (target?.tagName === 'INPUT') return;

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
    e.preventDefault();
    const result = await undoManager.undo();
    if (result && result.success) {
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
      if (result.imagesChanged) window.vpxEditor.refreshImageManager();
      if (result.materialsChanged) window.vpxEditor.refreshMaterialManager();
      if (result.soundsChanged) window.vpxEditor.refreshSoundManager();
    }
    return;
  }

  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
    e.preventDefault();
    const result = await undoManager.redo();
    if (result && result.success) {
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
      if (result.imagesChanged) window.vpxEditor.refreshImageManager();
      if (result.materialsChanged) window.vpxEditor.refreshMaterialManager();
      if (result.soundsChanged) window.vpxEditor.refreshSoundManager();
    }
    return;
  }

  const isConsoleFocused = document.activeElement === consoleOutput;

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'a') {
    e.preventDefault();
    if (isConsoleFocused) {
      if (consoleOutput) {
        const range = document.createRange();
        range.selectNodeContents(consoleOutput);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    } else {
      const allVisibleItems = Object.entries(state.items)
        .filter(([name, item]) => isItemVisible(item, name))
        .map(([name]) => name);
      if (allVisibleItems.length > 0) {
        setSelection(allVisibleItems, allVisibleItems[0]);
        updatePropertiesPanel();
        renderCurrentView();
      }
    }
    return;
  }

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'c') {
    const selectedText = window.getSelection()?.toString() || '';
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
    if (isEditableElementFocused()) return;
    if (state.isTableLocked) return;

    if (state.selectedNode) {
      deleteNode(state.selectedNode.itemName, state.selectedNode.nodeIndex);
      e.preventDefault();
      return;
    }

    if (state.selectedItems.length > 0) {
      const itemsToDelete = state.selectedItems.filter(name => {
        const item = getItem(name);
        return item && !item.is_locked;
      });
      if (itemsToDelete.length > 0) {
        undoManager.beginUndo(
          itemsToDelete.length > 1 ? `Delete ${itemsToDelete.length} items` : `Delete ${itemsToDelete[0]}`
        );
        (async () => {
          for (const name of itemsToDelete) {
            await deleteObject(name, true);
          }
          undoManager.endUndo();
          selectItem(null);
          updateItemsList();
          updatePropertiesPanel();
          renderCurrentView();
        })();
      }
      e.preventDefault();
      return;
    }

    if (state.selectedPartGroup && state.selectedPartGroup !== '_root') {
      showDeletePartGroupModal(state.selectedPartGroup);
      e.preventDefault();
      return;
    }

    if (state.selectedCollection) {
      deleteCollectionWithConfirm(state.selectedCollection);
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
      document.getElementById('toggle-wireframe')?.classList.toggle('active', isWireframe);
    }
  }
  if (e.key === 'Home') {
    if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
      resetCamera();
      if (elements.zoomLevelEl) {
        elements.zoomLevelEl.textContent = '100%';
      }
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

function getToolCursor(): string {
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
setTimeout(resizeCanvas, 0);

async function initTheme(): Promise<void> {
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
  } else if (data.mode === 'partgroup') {
    await renamePartGroup(data.oldName, data.newName);
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
  if (!state.extractedDir) return;
  const imagesResult = await window.vpxEditor.readFile(`${state.extractedDir}/images.json`);
  if (imagesResult.success && imagesResult.content) {
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
  if (!state.extractedDir) return;
  const materialsResult = await window.vpxEditor.readFile(`${state.extractedDir}/materials.json`);
  if (materialsResult.success && materialsResult.content) {
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
  if (!state.extractedDir) return;
  const soundsResult = await window.vpxEditor.readFile(`${state.extractedDir}/sounds.json`);
  if (soundsResult.success && soundsResult.content) {
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

window.vpxEditor.onGamedataChanged?.(async () => {
  if (!state.extractedDir) return;
  const gamedataResult = await window.vpxEditor.readFile(`${state.extractedDir}/gamedata.json`);
  if (gamedataResult.success && gamedataResult.content) {
    state.gamedata = JSON.parse(gamedataResult.content);
    updatePropertiesPanel();
    renderCurrentView();
  }
});

window.vpxEditor.onGameitemsChanged?.(gameitems => {
  state.gameitems = gameitems;
  renderCurrentView();
});

window.vpxEditor.onUndo?.(async () => {
  const result = await undoManager.undo();
  if (result && result.success) {
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
  if (result && result.success) {
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

function isEditableElementFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
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
    const item = getItem(name);
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
  const allVisibleItems = Object.entries(state.items)
    .filter(([name, item]) => isItemVisible(item, name))
    .map(([name]) => name);
  if (allVisibleItems.length > 0) {
    setSelection(allVisibleItems, allVisibleItems[0]);
    updatePropertiesPanel();
    renderCurrentView();
  }
});

window.vpxEditor.onUndoBegin?.(description => {
  undoManager.beginUndo(description);
});

window.vpxEditor.onUndoEnd?.(async () => {
  await undoManager.endUndo();
});

window.vpxEditor.onCollectionsUpdated?.(collections => {
  state.collections = collections as typeof state.collections;
  updateCollectionsList();
});

window.vpxEditor.onUndoCancel?.(() => {
  undoManager.cancelUndo();
});

window.vpxEditor.onMarkSavePoint?.(() => {
  undoManager.markSavePoint();
});

window.vpxEditor.onRecordScriptChange?.(async (before, after) => {
  await undoManager.recordScriptChange(before, after);
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

window.vpxEditor.onUndoMarkSounds?.(() => {
  undoManager.markSoundsForUndo();
});

window.vpxEditor.onUndoMarkSoundCreate?.(soundName => {
  undoManager.markSoundForCreate(soundName);
});

window.vpxEditor.onUndoMarkSoundDelete?.((soundName, soundData, filePath) => {
  undoManager.markSoundForDelete(soundName, soundData, filePath);
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
  if (!state.extractedDir) return;
  const renderProbesResult = await window.vpxEditor.readFile(`${state.extractedDir}/renderprobes.json`);
  if (renderProbesResult.success && renderProbesResult.content) {
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
    const qualityNum = typeof quality === 'string' ? parseInt(quality, 10) : quality;
    setMaxTextureSize(qualityNum);
  }
});

window.vpxEditor.onTextureQualityChanged?.(quality => {
  const qualityNum = typeof quality === 'string' ? parseInt(quality, 10) : quality;
  setMaxTextureSize(qualityNum);
  state.textureCache.clear();
  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    clearScene();
    render3D();
  }
  if (elements.statusBar) {
    elements.statusBar.textContent = qualityNum === 0 ? 'Texture quality: Full' : `Texture quality: ${qualityNum}px`;
  }
});

window.vpxEditor.onViewSettingsChanged?.(settings => {
  state.viewSolid = settings.solid ?? settings.viewSolid ?? state.viewSolid;
  state.viewOutline = settings.outline ?? settings.viewOutline ?? state.viewOutline;
  state.showGrid = settings.grid ?? settings.showGrid ?? state.showGrid;
  state.showBackdrop = settings.backdrop ?? settings.showBackdrop ?? state.showBackdrop;
  document.getElementById('toggle-grid')?.classList.toggle('active', state.showGrid);
  document.getElementById('toggle-backdrop')?.classList.toggle('active', state.showBackdrop);
  renderCurrentView();
});

window.vpxEditor.onToggleBackglassView?.(enabled => {
  if (state.viewMode === VIEW_MODE_3D) return;
  state.backglassView = enabled;
  document.getElementById('toggle-backglass')?.classList.toggle('active', state.backglassView);
  const tool3dBtn = document.getElementById('tool-3d') as HTMLButtonElement | null;
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
  window.vpxEditor.notifyBackglassViewChanged(state.backglassView);
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
  updatePropertiesPanel();
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

  if (data.options?.importMaterial && state.extractedDir) {
    const materialsResult = await window.vpxEditor.readFile(`${state.extractedDir}/materials.json`);
    if (materialsResult.success && materialsResult.content) {
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

  if (state.primarySelectedItem && state.extractedDir) {
    const item = getItem(state.primarySelectedItem!);
    if (item && item._fileName) {
      const itemResult = await window.vpxEditor.readFile(`${state.extractedDir}/${item._fileName}`);
      if (itemResult.success && itemResult.content) {
        const itemData = JSON.parse(itemResult.content);
        const itemType = Object.keys(itemData)[0];
        const newData = itemData[itemType];
        Object.assign(item, newData);
      }
    }
  }

  if (state.viewMode === VIEW_MODE_3D && is3DInitialized()) {
    if (state.primarySelectedItem) {
      invalidateItem(state.primarySelectedItem);
    }
    render3D();
  } else {
    render();
  }

  updatePropertiesPanel();
  if (elements.statusBar) {
    elements.statusBar.textContent = 'Mesh imported';
  }
});

async function initViewSettings(): Promise<void> {
  const settings = await window.vpxEditor.getViewSettings();
  if (settings) {
    state.viewSolid = settings.solid ?? settings.viewSolid ?? state.viewSolid;
    state.viewOutline = settings.outline ?? settings.viewOutline ?? state.viewOutline;
    state.showGrid = settings.grid ?? settings.showGrid ?? state.showGrid;
    state.showBackdrop = settings.backdrop ?? settings.showBackdrop ?? state.showBackdrop;
    document.getElementById('toggle-grid')?.classList.toggle('active', state.showGrid);
    document.getElementById('toggle-backdrop')?.classList.toggle('active', state.showBackdrop);
  }
}

initViewSettings();

function handleDocumentPointerEnd(): void {
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
        if (!getItem(itemName)?.is_locked) {
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
}
document.addEventListener('pointerup', handleDocumentPointerEnd);
document.addEventListener('pointercancel', handleDocumentPointerEnd);

window.vpxEditor.onRequestDrawingOrderData?.(mode => {
  window.vpxEditor.sendDrawingOrderData({
    mode,
    items: getDrawingOrderItems(mode as 'hit' | 'select'),
  });
});

initConsole();

window.vpxEditor.onApplyTransform?.(data => {
  if (!transformItemName) return;
  const item = getItem(transformItemName!);
  if (!item) return;

  restoreDragPoints(item, originalDragPoints);

  if (data.type === 'rotate') {
    applyRotation(item, data.angle ?? 0, data.useOrigin ?? false, data.centerX ?? 0, data.centerY ?? 0);
  } else if (data.type === 'scale') {
    applyScale(item, data.scaleX ?? 1, data.scaleY ?? 1, data.useOrigin ?? false, data.centerX ?? 0, data.centerY ?? 0);
  } else if (data.type === 'translate') {
    applyTranslate(item, data.offsetX ?? 0, data.offsetY ?? 0);
  }

  invalidateItem(transformItemName);
  renderCurrentView();
});

window.vpxEditor.onUndoTransform?.(() => {
  if (!transformItemName) return;
  const item = getItem(transformItemName!);
  if (!item) return;

  restoreDragPoints(item, originalDragPoints);
  invalidateItem(transformItemName);
  renderCurrentView();
});

window.vpxEditor.onSaveTransform?.(data => {
  if (!transformItemName) return;
  const item = getItem(transformItemName!);
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
  if (!transformItemName) return;
  const item = getItem(transformItemName!);
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
