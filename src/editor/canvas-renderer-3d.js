import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { state, isItemVisible, elements, isItemSelected } from './state.js';
import { selectItem } from './items-panel.js';
import { computeCameraParams, VIEW_MODE_MASKS, getSpaceReferenceOffset } from './view-setup.js';
import { getItemBounds } from './utils.js';

import { createWall3DMesh } from './objects/wall.js';
import { createFlipper3DMesh } from './objects/flipper.js';
import { createBumper3DMesh } from './objects/bumper.js';
import { createRubber3DMesh } from './objects/rubber.js';
import { createRamp3DMesh } from './objects/ramp.js';
import { createLight3DMesh } from './objects/light.js';
import { createKicker3DMesh } from './objects/kicker.js';
import { createTrigger3DMesh } from './objects/trigger.js';
import { createGate3DMesh } from './objects/gate.js';
import { createSpinner3DMesh } from './objects/spinner.js';
import { createPrimitive3DMesh } from './objects/primitive.js';
import { createHitTarget3DMesh } from './objects/hit-target.js';
import { createFlasher3DMesh } from './objects/flasher.js';
import { createBall3DMesh } from './objects/ball.js';

let scene, camera, renderer, controls;
let sceneContainer;
let playfieldMesh, backdropTexture;
let itemMeshes = new Map();
let isInitialized = false;
let animationFrameId = null;
let isAnimating = false;
let wireframeMode = false;
let ambientLight, light0, light1;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let baseDistance = 1500;
let zoomChangeCallback = null;
let previewMode = null;
let savedEditorCamera = null;
let cameraAnimationId = null;
let composer, outlinePass;

function isVisibleInPreviewMode(item) {
  if (!previewMode) return true;

  const modeMask = VIEW_MODE_MASKS[previewMode] || 0xffff;
  if (modeMask === 0xffff) return true;

  let groupName = item.part_group_name;
  while (groupName) {
    const partGroup = state.partGroups[groupName];
    if (!partGroup) break;

    const groupMask = partGroup.player_mode_visibility_mask ?? 0xffff;
    if ((groupMask & modeMask) === 0) {
      return false;
    }

    groupName = partGroup.part_group_name;
  }

  return true;
}

function getItemSpaceReference(item) {
  let groupName = item.part_group_name;
  while (groupName) {
    const partGroup = state.partGroups[groupName];
    if (!partGroup) break;

    const spaceRef = partGroup.space_reference;
    if (spaceRef && spaceRef !== 'inherit') {
      return spaceRef;
    }

    groupName = partGroup.part_group_name;
  }
  return 'playfield';
}

function getSceneBackgroundColor() {
  if (state.gamedata?.backdrop_color) {
    return new THREE.Color(state.gamedata.backdrop_color);
  }
  return new THREE.Color(0x626e8e);
}

export function updateSceneBackground() {
  if (scene) {
    scene.background = getSceneBackgroundColor();
  }
}

export function init3D(container) {
  if (isInitialized) return;

  scene = new THREE.Scene();
  scene.background = getSceneBackgroundColor();

  sceneContainer = new THREE.Group();
  sceneContainer.scale.y = -1;
  scene.add(sceneContainer);

  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 1, 20000);
  camera.position.set(500, 2500, 1500);
  camera.up.set(0, 0, 1);

  renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  outlinePass = new OutlinePass(new THREE.Vector2(container.clientWidth, container.clientHeight), scene, camera);
  outlinePass.edgeStrength = 3.0;
  outlinePass.edgeGlow = 0.0;
  outlinePass.edgeThickness = 1.0;
  outlinePass.visibleEdgeColor.set(0xffffff);
  outlinePass.hiddenEdgeColor.set(0x888888);
  composer.addPass(outlinePass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(500, 800, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.update();

  renderer.domElement.addEventListener(
    'pointerdown',
    e => {
      if (e.button === 1 && e.shiftKey) {
        controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
      } else if (e.button === 1) {
        controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
      }

      const allowOrbit = state.tool === 'pan' || e.altKey;
      if (e.button === 0) {
        controls.enabled = allowOrbit;
        if (allowOrbit) {
          controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
          renderer.domElement.style.cursor = 'grabbing';
        }
      }
    },
    true
  );

  renderer.domElement.addEventListener('pointerup', e => {
    controls.enabled = true;
    controls.mouseButtons.LEFT = null;
    if (e.altKey || state.tool === 'pan') {
      renderer.domElement.style.cursor = 'grab';
    } else {
      renderer.domElement.style.cursor = 'default';
    }
  });

  ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  light0 = new THREE.PointLight(0xfffff0, 1.0);
  scene.add(light0);

  light1 = new THREE.PointLight(0xfffff0, 1.0);
  scene.add(light1);

  renderer.domElement.addEventListener('click', onClick3D);

  isInitialized = true;
}

let keyboardEnabled = false;

export function enable3DKeyboard() {
  if (keyboardEnabled) return;
  window.addEventListener('keydown', handle3DKeyDown);
  keyboardEnabled = true;
}

export function disable3DKeyboard() {
  if (!keyboardEnabled) return;
  window.removeEventListener('keydown', handle3DKeyDown);
  keyboardEnabled = false;
}

export function resize3D(width, height) {
  if (!isInitialized) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (composer) composer.setSize(width, height);
}

export function updateSceneLighting() {
  if (!isInitialized || !state.gamedata) return;

  const gd = state.gamedata;

  const emissionColor = new THREE.Color(gd.light0_emission || '#fffff0');

  const lightHeight = gd.light_height || 5000;
  const tableRight = gd.right || 952;
  const tableBottom = gd.bottom || 2162;

  const centerX = tableRight * 0.5;
  const posY0 = tableBottom * (1.0 / 3.0);
  const posY1 = tableBottom * (2.0 / 3.0);

  ambientLight.color.setRGB(1, 1, 1);
  ambientLight.intensity = 1.0;

  light0.color.copy(emissionColor);
  light0.position.set(centerX, posY0, lightHeight * 0.5);
  light0.distance = 0;
  light0.decay = 0;
  light0.intensity = 1.5;

  light1.color.copy(emissionColor);
  light1.position.set(centerX, posY1, lightHeight * 0.5);
  light1.distance = 0;
  light1.decay = 0;
  light1.intensity = 1.5;
}

export function resetCamera() {
  if (!isInitialized || !state.gamedata) return;

  const width = state.gamedata.right - state.gamedata.left;
  const height = state.gamedata.bottom - state.gamedata.top;
  const centerX = width / 2;
  const centerY = height / 2;

  camera.position.set(centerX, -(height * 1.3), height * 0.9);
  controls.target.set(centerX, -centerY, 0);
  controls.update();

  baseDistance = camera.position.distanceTo(controls.target);
}

let focusAnimationId = null;
let isOrthographic = false;

export function setPresetView(view) {
  if (!isInitialized || !state.gamedata) return;

  const width = state.gamedata.right - state.gamedata.left;
  const height = state.gamedata.bottom - state.gamedata.top;
  const centerX = width / 2;
  const centerY = -height / 2;
  const distance = height * 1.2;
  let position;
  let up = new THREE.Vector3(0, 0, 1);

  switch (view) {
    case 'front':
      position = new THREE.Vector3(centerX, -height - distance * 0.3, 0);
      break;
    case 'back':
      position = new THREE.Vector3(centerX, distance * 0.3, 0);
      break;
    case 'left':
      position = new THREE.Vector3(-distance * 0.5, centerY, 0);
      break;
    case 'right':
      position = new THREE.Vector3(width + distance * 0.5, centerY, 0);
      break;
    case 'top':
      position = new THREE.Vector3(centerX, centerY, distance);
      up = new THREE.Vector3(0, 1, 0);
      break;
    case 'bottom':
      position = new THREE.Vector3(centerX, centerY, -distance);
      up = new THREE.Vector3(0, -1, 0);
      break;
    default:
      return;
  }

  camera.position.copy(position);
  camera.up.copy(up);
  controls.target.set(centerX, centerY, 0);
  controls.update();
}

export function toggleOrthographic() {
  if (!isInitialized) return;

  isOrthographic = !isOrthographic;

  const container = renderer.domElement.parentElement;
  const aspect = container.clientWidth / container.clientHeight;
  const distance = camera.position.distanceTo(controls.target);

  if (isOrthographic) {
    const frustumSize = distance * Math.tan((camera.fov * Math.PI) / 180 / 2) * 2;
    const newCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      1,
      20000
    );
    newCamera.position.copy(camera.position);
    newCamera.up.copy(camera.up);
    newCamera.lookAt(controls.target);
    camera = newCamera;
  } else {
    const newCamera = new THREE.PerspectiveCamera(45, aspect, 1, 20000);
    newCamera.position.copy(camera.position);
    newCamera.up.copy(camera.up);
    newCamera.lookAt(controls.target);
    camera = newCamera;
  }

  controls.object = camera;
  composer.passes[0].camera = camera;
  outlinePass.renderCamera = camera;
  controls.update();

  return isOrthographic;
}

export function focusOnSelection() {
  if (!isInitialized || !state.gamedata) return;

  if (state.selectedItems.size === 0) {
    resetCamera();
    return;
  }

  focusOnBounds3D(Array.from(state.selectedItems));
}

function handle3DKeyDown(e) {
  if (!isInitialized || previewMode) return;

  const activeEl = document.activeElement;
  const isInput =
    activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
  if (isInput) return;

  const key = e.code;

  if (key === 'Numpad5' || key === 'Digit5') {
    e.preventDefault();
    toggleOrthographic();
    return;
  }

  if (key === 'NumpadDecimal' || key === 'Period') {
    e.preventDefault();
    focusOnSelection();
    return;
  }

  if (key === 'Numpad1' || key === 'Digit1') {
    e.preventDefault();
    setPresetView(e.ctrlKey || e.metaKey ? 'back' : 'front');
    return;
  }

  if (key === 'Numpad3' || key === 'Digit3') {
    e.preventDefault();
    setPresetView(e.ctrlKey || e.metaKey ? 'right' : 'left');
    return;
  }

  if (key === 'Numpad7' || key === 'Digit7') {
    e.preventDefault();
    setPresetView(e.ctrlKey || e.metaKey ? 'bottom' : 'top');
    return;
  }
}

export function focusOnPoint3D(worldX, worldY, item) {
  if (!isInitialized) return;

  const z = item?.position?.z || item?.center?.z || 0;
  const targetPoint = new THREE.Vector3(worldX, -worldY, z);

  const direction = camera.position.clone().sub(controls.target).normalize();
  const currentDistance = camera.position.distanceTo(controls.target);
  const targetDistance = Math.min(currentDistance, 800);

  const endTarget = targetPoint.clone();
  const endCamera = targetPoint.clone().add(direction.multiplyScalar(targetDistance));

  const startTarget = controls.target.clone();
  const startCamera = camera.position.clone();

  if (focusAnimationId) {
    cancelAnimationFrame(focusAnimationId);
    focusAnimationId = null;
  }

  const startTime = performance.now();
  const duration = 300;

  function animateStep(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    controls.target.lerpVectors(startTarget, endTarget, eased);
    camera.position.lerpVectors(startCamera, endCamera, eased);
    controls.update();

    if (progress < 1) {
      focusAnimationId = requestAnimationFrame(animateStep);
    } else {
      focusAnimationId = null;
    }
  }

  focusAnimationId = requestAnimationFrame(animateStep);
}

export function focusOnBounds3D(itemNames) {
  if (!isInitialized || !itemNames || itemNames.length === 0) return;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const name of itemNames) {
    const item = state.items[name];
    if (!item) continue;
    const bounds = getItemBounds(item);
    if (!bounds) continue;
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }

  if (minX === Infinity) return;

  const padding = 100;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const boundsWidth = maxX - minX;
  const boundsHeight = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const targetPoint = new THREE.Vector3(centerX, -centerY, 0);

  const direction = camera.position.clone().sub(controls.target).normalize();
  const fov = camera.fov * (Math.PI / 180);
  const aspect = camera.aspect;

  const distanceForHeight = boundsHeight / 2 / Math.tan(fov / 2);
  const distanceForWidth = boundsWidth / 2 / (Math.tan(fov / 2) * aspect);
  const targetDistance = Math.max(distanceForHeight, distanceForWidth) * 1.2;

  const endTarget = targetPoint.clone();
  const endCamera = targetPoint.clone().add(direction.multiplyScalar(targetDistance));

  const startTarget = controls.target.clone();
  const startCamera = camera.position.clone();

  if (focusAnimationId) {
    cancelAnimationFrame(focusAnimationId);
    focusAnimationId = null;
  }

  const startTime = performance.now();
  const duration = 300;

  function animateStep(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    controls.target.lerpVectors(startTarget, endTarget, eased);
    camera.position.lerpVectors(startCamera, endCamera, eased);
    controls.update();

    if (progress < 1) {
      focusAnimationId = requestAnimationFrame(animateStep);
    } else {
      focusAnimationId = null;
    }
  }

  focusAnimationId = requestAnimationFrame(animateStep);
}

export function getZoom3D() {
  if (!isInitialized) return 1;
  const distance = camera.position.distanceTo(controls.target);
  return baseDistance / distance;
}

export function setZoom3D(factor) {
  if (!isInitialized) return;
  const currentZoom = getZoom3D();
  const newZoom = currentZoom * factor;
  const newDistance = baseDistance / newZoom;
  const direction = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).add(direction.multiplyScalar(newDistance));
  controls.update();
}

export function onZoomChange(callback) {
  zoomChangeCallback = callback;
}

export function startAnimation() {
  if (isAnimating) return;
  isAnimating = true;
  animate();
}

export function stopAnimation() {
  isAnimating = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

let lastZoom = 1;

function animate() {
  if (!isAnimating) return;
  animationFrameId = requestAnimationFrame(animate);

  if (!isInitialized || !state.gamedata) return;

  controls.update();
  updateSelectionOutline();
  composer.render();

  const currentZoom = getZoom3D();
  if (Math.abs(currentZoom - lastZoom) > 0.001 && zoomChangeCallback) {
    lastZoom = currentZoom;
    zoomChangeCallback(currentZoom);
  }
}

export function render3D(resetView = false) {
  if (!isInitialized || !state.gamedata) return;
  buildScene();
  if (resetView) {
    resetCamera();
  }
  startAnimation();
}

export function clearScene() {
  for (const [name, mesh] of itemMeshes) {
    sceneContainer.remove(mesh);
    disposeObject(mesh);
  }
  itemMeshes.clear();

  if (playfieldMesh) {
    sceneContainer.remove(playfieldMesh);
    disposeObject(playfieldMesh);
    playfieldMesh = null;
  }

  if (backdropTexture) {
    backdropTexture.dispose();
    backdropTexture = null;
  }
}

function disposeObject(obj) {
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) {
      obj.material.forEach(m => m.dispose());
    } else {
      obj.material.dispose();
    }
  }
  if (obj.children) {
    obj.children.forEach(child => disposeObject(child));
  }
}

function applyWireframeMode() {
  scene.traverse(obj => {
    if (obj.isMesh && obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => (m.wireframe = wireframeMode));
      } else {
        obj.material.wireframe = wireframeMode;
      }
    }
  });
}

function buildScene() {
  updateSceneBackground();
  updateSceneLighting();
  updatePlayfield();
  updateItems();
  applyWireframeMode();
}

export function refresh3DScene() {
  if (!isInitialized || !state.gamedata) return;
  buildScene();
  composer.render();
}

export function invalidateItem(itemName) {
  if (!isInitialized) return;
  const mesh = itemMeshes.get(itemName);
  if (mesh) {
    sceneContainer.remove(mesh);
    disposeObject(mesh);
    itemMeshes.delete(itemName);
  }
}

export function invalidateAllItems() {
  if (!isInitialized) return;
  for (const [itemName, mesh] of itemMeshes) {
    sceneContainer.remove(mesh);
    disposeObject(mesh);
  }
  itemMeshes.clear();
}

function hasExplicitPlayfieldMesh() {
  if (!state.items) return false;
  for (const [name, item] of Object.entries(state.items)) {
    if (item.name === 'playfield_mesh') return true;
  }
  return false;
}

function updatePlayfield() {
  if (hasExplicitPlayfieldMesh()) {
    if (playfieldMesh) {
      sceneContainer.remove(playfieldMesh);
      playfieldMesh.geometry.dispose();
      playfieldMesh.material.dispose();
      playfieldMesh = null;
      backdropTexture = null;
    }
    return;
  }

  const width = state.gamedata.right - state.gamedata.left;
  const height = state.gamedata.bottom - state.gamedata.top;

  if (!playfieldMesh) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const uvs = geometry.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
      uvs.setY(i, 1 - uvs.getY(i));
    }
    uvs.needsUpdate = true;

    const material = new THREE.MeshStandardMaterial({
      color: 0x2a4a2a,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    playfieldMesh = new THREE.Mesh(geometry, material);
    playfieldMesh.position.set(width / 2, height / 2, -1);
    sceneContainer.add(playfieldMesh);
  }

  if (state.backdropImage && !backdropTexture) {
    const texture = new THREE.Texture(state.backdropImage);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    playfieldMesh.material.map = texture;
    playfieldMesh.material.color.set(0xffffff);
    playfieldMesh.material.needsUpdate = true;
    backdropTexture = texture;
  }
}

function updateItems() {
  const currentItems = new Set();

  for (const [name, item] of Object.entries(state.items)) {
    const isPlayfieldMesh = item.name === 'playfield_mesh';
    if (!isPlayfieldMesh && (item.is_visible === false || item.visible === false)) continue;
    if (!isItemVisible(item, name)) continue;
    if (!isVisibleInPreviewMode(item)) continue;

    currentItems.add(name);

    if (!itemMeshes.has(name)) {
      const mesh = createItemMesh(item);
      if (mesh) {
        const spaceRef = getItemSpaceReference(item);
        const zOffset = getSpaceReferenceOffset(state.gamedata, spaceRef);

        if (zOffset !== 0) {
          const wrapper = new THREE.Group();
          wrapper.userData.itemName = name;
          wrapper.position.z = zOffset;
          wrapper.add(mesh);
          itemMeshes.set(name, wrapper);
          sceneContainer.add(wrapper);
        } else {
          mesh.userData.itemName = name;
          itemMeshes.set(name, mesh);
          sceneContainer.add(mesh);
        }
      }
    }

    updateItemMesh(name, item);
  }

  for (const [name, mesh] of itemMeshes) {
    if (!currentItems.has(name)) {
      sceneContainer.remove(mesh);
      disposeObject(mesh);
      itemMeshes.delete(name);
    }
  }

  updateSelectionOutline();
}

function createItemMesh(item) {
  switch (item._type) {
    case 'Wall':
    case 'Surface':
      return createWall3DMesh(item);
    case 'Flipper':
      return createFlipper3DMesh(item);
    case 'Bumper':
      return createBumper3DMesh(item);
    case 'Rubber':
      return createRubber3DMesh(item);
    case 'Ramp':
      return createRamp3DMesh(item);
    case 'Light':
      return createLight3DMesh(item);
    case 'Kicker':
      return createKicker3DMesh(item);
    case 'Trigger':
      return createTrigger3DMesh(item);
    case 'Gate':
      return createGate3DMesh(item);
    case 'Spinner':
      return createSpinner3DMesh(item);
    case 'Primitive':
      return createPrimitive3DMesh(item);
    case 'HitTarget':
      return createHitTarget3DMesh(item);
    case 'Flasher':
      return createFlasher3DMesh(item);
    case 'Ball':
      return createBall3DMesh(item);
    default:
      return null;
  }
}

function updateItemMesh(name, item) {}

function updateSelectionOutline() {
  if (!outlinePass) return;
  const selectedObjects = [];
  for (const name of state.selectedItems) {
    const mesh = itemMeshes.get(name);
    if (mesh) selectedObjects.push(mesh);
  }
  outlinePass.selectedObjects = selectedObjects;
}

function getItemNameFromObject(obj) {
  let current = obj;
  while (current) {
    if (current.userData && current.userData.itemName) {
      return current.userData.itemName;
    }
    current = current.parent;
  }
  return null;
}

function onClick3D(event) {
  if (!isInitialized || !renderer) return;
  if (state.tool === 'pan' || event.altKey) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(sceneContainer.children, true);

  const hitNames = [];
  const seen = new Set();

  for (const intersect of intersects) {
    const name = getItemNameFromObject(intersect.object);
    if (name && !seen.has(name)) {
      seen.add(name);
      hitNames.push(name);
    }
  }

  if (hitNames.length === 0) {
    selectItem(null, true);
  } else {
    selectItem(hitNames[0], true);
  }
}

export function cleanup3D() {
  if (!isInitialized) return;

  stopAnimation();
  clearScene();
  disable3DKeyboard();

  renderer.dispose();
  isInitialized = false;
}

export function get3DRenderer() {
  return renderer;
}

export function is3DInitialized() {
  return isInitialized;
}

export function toggleWireframe() {
  if (!isInitialized) return false;

  wireframeMode = !wireframeMode;

  scene.traverse(obj => {
    if (obj.isMesh && obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => (m.wireframe = wireframeMode));
      } else {
        obj.material.wireframe = wireframeMode;
      }
    }
  });

  return wireframeMode;
}

function animateCameraTo(targetPosition, targetLookAt, targetFov, duration = 500) {
  if (cameraAnimationId) {
    cancelAnimationFrame(cameraAnimationId);
    cameraAnimationId = null;
  }

  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  const startFov = camera.fov;
  const startTime = performance.now();

  function animateStep(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPosition, targetPosition, eased);
    controls.target.lerpVectors(startTarget, targetLookAt, eased);
    camera.fov = startFov + (targetFov - startFov) * eased;
    camera.updateProjectionMatrix();

    if (progress < 1) {
      cameraAnimationId = requestAnimationFrame(animateStep);
    } else {
      cameraAnimationId = null;
    }
  }

  cameraAnimationId = requestAnimationFrame(animateStep);
}

export function enterPreviewMode(mode) {
  if (!isInitialized || previewMode === mode) return;

  if (!savedEditorCamera) {
    savedEditorCamera = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      fov: camera.fov,
    };
  }

  previewMode = mode;
  controls.enabled = false;

  buildScene();

  const params = computeCameraParams(state.gamedata, mode);
  animateCameraTo(params.position, params.target, params.fov);
}

export function exitPreviewMode() {
  if (!isInitialized || !previewMode) return;

  previewMode = null;
  controls.enabled = true;

  buildScene();

  if (savedEditorCamera) {
    animateCameraTo(savedEditorCamera.position, savedEditorCamera.target, savedEditorCamera.fov);
    savedEditorCamera = null;
  }
}

export function getPreviewMode() {
  return previewMode;
}

export function getWireframeMode() {
  return wireframeMode;
}
