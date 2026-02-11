import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { state, isItemVisible, getItem, getPartGroup } from './state.js';
import type { GameItem } from './state.js';
import { selectItem } from './items-panel.js';
import { computeCameraParams, VIEW_MODE_MASKS, getSpaceReferenceOffset, type ViewMode } from './view-setup.js';
import { getItemBounds } from './utils.js';
import { CAMERA_BASE_DISTANCE, CAMERA_ANIMATION_DURATION } from '../shared/constants.js';
import type { GameData } from '../types/data.js';

import { getEditable } from './parts/index.js';

type PreviewMode = 'desktop' | 'fullscreen' | 'cabinet' | 'mixedreality' | 'vr' | null;
type ZoomChangeCallback = (zoom: number) => void;

interface SavedCameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

interface CameraParams {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

interface ItemBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface ItemWithPosition extends GameItem {
  position?: { x: number; y: number; z?: number };
  center?: { x: number; y: number; z?: number };
}

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let sceneContainer: THREE.Group;
let playfieldMesh: THREE.Mesh | null;
let backdropTexture: THREE.Texture | null;
let itemMeshes: Map<string, THREE.Object3D> = new Map();
let isInitialized: boolean = false;
let animationFrameId: number | null = null;
let isAnimating: boolean = false;
let wireframeMode: boolean = false;
let ambientLight: THREE.AmbientLight;
let light0: THREE.PointLight;
let light1: THREE.PointLight;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let baseDistance: number = CAMERA_BASE_DISTANCE;
let zoomChangeCallback: ZoomChangeCallback | null = null;
let previewMode: PreviewMode = null;
let savedEditorCamera: SavedCameraState | null = null;
let cameraAnimationId: number | null = null;
let composer: EffectComposer;
let outlinePass: OutlinePass;
let metalEnvMap: THREE.Texture | null = null;

export function getMetalEnvMap(): THREE.Texture | null {
  return metalEnvMap;
}

function isVisibleInPreviewMode(item: GameItem): boolean {
  if (!previewMode) return true;

  const modeMask = VIEW_MODE_MASKS[previewMode as keyof typeof VIEW_MODE_MASKS] || 0xffff;
  if (modeMask === 0xffff) return true;

  let groupName = item.part_group_name;
  while (groupName) {
    const partGroup = getPartGroup(groupName);
    if (!partGroup) break;

    const groupMask = (partGroup.player_mode_visibility_mask as number | undefined) ?? 0xffff;
    if ((groupMask & modeMask) === 0) {
      return false;
    }

    groupName = partGroup.part_group_name;
  }

  return true;
}

function getItemSpaceReference(item: GameItem): string {
  let groupName = item.part_group_name;
  while (groupName) {
    const partGroup = getPartGroup(groupName);
    if (!partGroup) break;

    const spaceRef = partGroup.space_reference;
    if (spaceRef && spaceRef !== 'inherit') {
      return spaceRef;
    }

    groupName = partGroup.part_group_name;
  }
  return 'playfield';
}

function getSceneBackgroundColor(): THREE.Color {
  const gd = state.gamedata as GameData | null;
  if (gd?.backdrop_color) {
    return new THREE.Color(gd.backdrop_color);
  }
  return new THREE.Color(0x626e8e);
}

export function updateSceneBackground(): void {
  if (scene) {
    scene.background = getSceneBackgroundColor();
  }
}

export function init3D(container: HTMLElement): void {
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
    (e: PointerEvent) => {
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

  renderer.domElement.addEventListener('pointerup', (e: PointerEvent) => {
    controls.enabled = true;
    controls.mouseButtons.LEFT = null;
    if (e.altKey || state.tool === 'pan') {
      renderer.domElement.style.cursor = 'grab';
    } else {
      renderer.domElement.style.cursor = 'default';
    }
  });

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  metalEnvMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremGenerator.dispose();

  ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  light0 = new THREE.PointLight(0xfffff0, 1.0);
  scene.add(light0);

  light1 = new THREE.PointLight(0xfffff0, 1.0);
  scene.add(light1);

  renderer.domElement.addEventListener('click', onClick3D);

  isInitialized = true;
}

let keyboardEnabled: boolean = false;

export function enable3DKeyboard(): void {
  if (keyboardEnabled) return;
  window.addEventListener('keydown', handle3DKeyDown);
  keyboardEnabled = true;
}

export function disable3DKeyboard(): void {
  if (!keyboardEnabled) return;
  window.removeEventListener('keydown', handle3DKeyDown);
  keyboardEnabled = false;
}

export function resize3D(width: number, height: number): void {
  if (!isInitialized) return;
  (camera as THREE.PerspectiveCamera).aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (composer) composer.setSize(width, height);
}

export function updateSceneLighting(): void {
  if (!isInitialized || !state.gamedata) return;

  const gd = state.gamedata as GameData;

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

export function resetCamera(): void {
  if (!isInitialized || !state.gamedata) return;

  if (previewMode) {
    const params = computeCameraParams(state.gamedata, previewMode as ViewMode);
    camera.position.copy(params.position);
    controls.target.copy(params.target);
    (camera as THREE.PerspectiveCamera).fov = params.fov;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    controls.update();
    baseDistance = camera.position.distanceTo(controls.target);
    return;
  }

  const gd = state.gamedata as GameData;
  const width = (gd.right ?? 0) - (gd.left ?? 0);
  const height = (gd.bottom ?? 0) - (gd.top ?? 0);
  const centerX = width / 2;
  const centerY = height / 2;

  camera.position.set(centerX, -(height * 1.3), height * 0.9);
  controls.target.set(centerX, -centerY, 0);
  controls.update();

  baseDistance = camera.position.distanceTo(controls.target);
}

let focusAnimationId: number | null = null;
let isOrthographic: boolean = false;

export function setPresetView(view: string): void {
  if (!isInitialized || !state.gamedata) return;

  const gd = state.gamedata as GameData;
  const width = (gd.right ?? 0) - (gd.left ?? 0);
  const height = (gd.bottom ?? 0) - (gd.top ?? 0);
  const centerX = width / 2;
  const centerY = -height / 2;
  const distance = height * 1.2;
  let position: THREE.Vector3;
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

export function toggleOrthographic(): boolean {
  if (!isInitialized) return false;

  isOrthographic = !isOrthographic;

  const container = renderer.domElement.parentElement!;
  const aspect = container.clientWidth / container.clientHeight;
  const distance = camera.position.distanceTo(controls.target);

  if (isOrthographic) {
    const frustumSize = distance * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180 / 2) * 2;
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
  (composer.passes[0] as RenderPass).camera = camera;
  outlinePass.renderCamera = camera;
  controls.update();

  return isOrthographic;
}

export function focusOnSelection(): void {
  if (!isInitialized || !state.gamedata) return;

  if (state.selectedItems.length === 0) {
    resetCamera();
    return;
  }

  focusOnBounds3D(state.selectedItems);
}

function handle3DKeyDown(e: KeyboardEvent): void {
  if (!isInitialized || previewMode) return;

  const activeEl = document.activeElement as HTMLElement | null;
  const isInput =
    activeEl &&
    (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);
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

export function focusOnPoint3D(worldX: number, worldY: number, item?: ItemWithPosition): void {
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

  function animateStep(currentTime: number): void {
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

export function focusOnBounds3D(itemNames: string[]): void {
  if (!isInitialized || !itemNames || itemNames.length === 0) return;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const name of itemNames) {
    const item = getItem(name);
    if (!item) continue;
    const bounds = getItemBounds(item) as ItemBounds | null;
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
  const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
  const aspect = (camera as THREE.PerspectiveCamera).aspect;

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

  function animateStep(currentTime: number): void {
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

export function getZoom3D(): number {
  if (!isInitialized) return 1;
  const distance = camera.position.distanceTo(controls.target);
  return baseDistance / distance;
}

export function setZoom3D(factor: number): void {
  if (!isInitialized) return;
  const currentZoom = getZoom3D();
  const newZoom = currentZoom * factor;
  const newDistance = baseDistance / newZoom;
  const direction = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).add(direction.multiplyScalar(newDistance));
  controls.update();
}

export function onZoomChange(callback: ZoomChangeCallback): void {
  zoomChangeCallback = callback;
}

export function startAnimation(): void {
  if (isAnimating) return;
  isAnimating = true;
  animate();
}

export function stopAnimation(): void {
  isAnimating = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

let lastZoom: number = 1;

function animate(): void {
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

export function render3D(resetView: boolean = false): void {
  if (!isInitialized || !state.gamedata) return;
  buildScene();
  if (resetView) {
    resetCamera();
  }
  startAnimation();
}

export function clearScene(): void {
  for (const [, mesh] of itemMeshes) {
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

function disposeObject(obj: THREE.Object3D): void {
  if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
  if ((obj as THREE.Mesh).material) {
    const material = (obj as THREE.Mesh).material;
    if (Array.isArray(material)) {
      material.forEach(m => m.dispose());
    } else {
      (material as THREE.Material).dispose();
    }
  }
  if (obj.children) {
    obj.children.forEach(child => disposeObject(child));
  }
}

function applyWireframeMode(): void {
  scene.traverse(obj => {
    if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).material) {
      const material = (obj as THREE.Mesh).material;
      if (Array.isArray(material)) {
        material.forEach(m => ((m as THREE.MeshBasicMaterial).wireframe = wireframeMode));
      } else {
        (material as THREE.MeshBasicMaterial).wireframe = wireframeMode;
      }
    }
  });
}

function buildScene(): void {
  updateSceneBackground();
  updateSceneLighting();
  updatePlayfield();
  updateItems();
  applyWireframeMode();
}

export function refresh3DScene(): void {
  if (!isInitialized || !state.gamedata) return;
  buildScene();
  composer.render();
}

export function invalidateItem(itemName: string): void {
  if (!isInitialized) return;
  const key = itemName.toLowerCase();
  const mesh = itemMeshes.get(key);
  if (mesh) {
    sceneContainer.remove(mesh);
    disposeObject(mesh);
    itemMeshes.delete(key);
  }
}

export function invalidateAllItems(): void {
  if (!isInitialized) return;
  for (const [, mesh] of itemMeshes) {
    sceneContainer.remove(mesh);
    disposeObject(mesh);
  }
  itemMeshes.clear();
}

function hasExplicitPlayfieldMesh(): boolean {
  if (!state.items) return false;
  for (const [, item] of Object.entries(state.items)) {
    if (item.name === 'playfield_mesh') return true;
  }
  return false;
}

function updatePlayfield(): void {
  if (hasExplicitPlayfieldMesh()) {
    if (playfieldMesh) {
      sceneContainer.remove(playfieldMesh);
      playfieldMesh.geometry.dispose();
      (playfieldMesh.material as THREE.Material).dispose();
      playfieldMesh = null;
      backdropTexture = null;
    }
    return;
  }

  if (!state.gamedata) return;

  const gd = state.gamedata as GameData;
  const width = (gd.right ?? 0) - (gd.left ?? 0);
  const height = (gd.bottom ?? 0) - (gd.top ?? 0);

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
    (playfieldMesh.material as THREE.MeshStandardMaterial).map = texture;
    (playfieldMesh.material as THREE.MeshStandardMaterial).color.set(0xffffff);
    (playfieldMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
    backdropTexture = texture;
  }
}

interface ItemWithVisibility extends GameItem {
  is_visible?: boolean;
  visible?: boolean;
}

function updateItems(): void {
  const currentItems = new Set<string>();

  for (const [name, item] of Object.entries(state.items)) {
    const isPlayfieldMesh = item.name === 'playfield_mesh';
    if (
      !isPlayfieldMesh &&
      ((item as ItemWithVisibility).is_visible === false || (item as ItemWithVisibility).visible === false)
    )
      continue;
    if (!isItemVisible(item, name)) continue;
    if (!isVisibleInPreviewMode(item)) continue;

    currentItems.add(name);

    const spaceRef = getItemSpaceReference(item);
    const zOffset = getSpaceReferenceOffset(state.gamedata, spaceRef);

    if (!itemMeshes.has(name)) {
      const mesh = createItemMesh(item);
      if (mesh) {
        if (zOffset !== 0) {
          const wrapper = new THREE.Group();
          wrapper.userData.itemName = name;
          wrapper.userData.zOffset = zOffset;
          wrapper.position.z = zOffset;
          wrapper.add(mesh);
          itemMeshes.set(name, wrapper);
          sceneContainer.add(wrapper);
        } else {
          mesh.userData.itemName = name;
          mesh.userData.zOffset = 0;
          itemMeshes.set(name, mesh);
          sceneContainer.add(mesh);
        }
      }
    } else {
      const existingMesh = itemMeshes.get(name)!;
      const currentOffset = existingMesh.userData.zOffset ?? 0;
      if (currentOffset !== zOffset) {
        sceneContainer.remove(existingMesh);
        disposeObject(existingMesh);
        itemMeshes.delete(name);

        const mesh = createItemMesh(item);
        if (mesh) {
          if (zOffset !== 0) {
            const wrapper = new THREE.Group();
            wrapper.userData.itemName = name;
            wrapper.userData.zOffset = zOffset;
            wrapper.position.z = zOffset;
            wrapper.add(mesh);
            itemMeshes.set(name, wrapper);
            sceneContainer.add(wrapper);
          } else {
            mesh.userData.itemName = name;
            mesh.userData.zOffset = 0;
            itemMeshes.set(name, mesh);
            sceneContainer.add(mesh);
          }
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

function applyDepthBias(obj: THREE.Object3D, depthBias: number): void {
  obj.renderOrder = depthBias;
  obj.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      const mat = (child as THREE.Mesh).material;
      const materials = Array.isArray(mat) ? mat : [mat];
      for (const m of materials) {
        m.polygonOffset = true;
        m.polygonOffsetFactor = -depthBias;
        m.polygonOffsetUnits = -depthBias;
      }
    }
  });
}

function createItemMesh(item: GameItem): THREE.Object3D | null {
  const renderer = getEditable(item._type);
  const mesh = renderer?.create3DMesh?.(item) ?? null;
  if (mesh) {
    const depthBias = (item as { depth_bias?: number }).depth_bias;
    if (depthBias && depthBias !== 0) {
      applyDepthBias(mesh, depthBias);
    }
  }
  return mesh;
}

function updateItemMesh(_name: string, _item: GameItem): void {}

function updateSelectionOutline(): void {
  if (!outlinePass) return;
  const selectedObjects: THREE.Object3D[] = [];
  for (const name of state.selectedItems) {
    const mesh = itemMeshes.get(name.toLowerCase());
    if (mesh) selectedObjects.push(mesh);
  }
  outlinePass.selectedObjects = selectedObjects;
}

function getItemNameFromObject(obj: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current.userData && current.userData.itemName) {
      return current.userData.itemName as string;
    }
    current = current.parent;
  }
  return null;
}

function onClick3D(event: MouseEvent): void {
  if (!isInitialized || !renderer) return;
  if (state.tool === 'pan' || event.altKey) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(sceneContainer.children, true);

  const hitNames: string[] = [];
  const seen = new Set<string>();

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

export function cleanup3D(): void {
  if (!isInitialized) return;

  stopAnimation();
  clearScene();
  disable3DKeyboard();

  renderer.dispose();
  isInitialized = false;
}

export function get3DRenderer(): THREE.WebGLRenderer {
  return renderer;
}

export function is3DInitialized(): boolean {
  return isInitialized;
}

export function toggleWireframe(): boolean {
  if (!isInitialized) return false;

  wireframeMode = !wireframeMode;

  scene.traverse(obj => {
    if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).material) {
      const material = (obj as THREE.Mesh).material;
      if (Array.isArray(material)) {
        material.forEach(m => ((m as THREE.MeshBasicMaterial).wireframe = wireframeMode));
      } else {
        (material as THREE.MeshBasicMaterial).wireframe = wireframeMode;
      }
    }
  });

  return wireframeMode;
}

function animateCameraTo(
  targetPosition: THREE.Vector3,
  targetLookAt: THREE.Vector3,
  targetFov: number,
  duration: number = CAMERA_ANIMATION_DURATION
): void {
  if (cameraAnimationId) {
    cancelAnimationFrame(cameraAnimationId);
    cameraAnimationId = null;
  }

  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  const startFov = (camera as THREE.PerspectiveCamera).fov;
  const startTime = performance.now();

  function animateStep(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPosition, targetPosition, eased);
    controls.target.lerpVectors(startTarget, targetLookAt, eased);
    (camera as THREE.PerspectiveCamera).fov = startFov + (targetFov - startFov) * eased;
    camera.updateProjectionMatrix();

    if (progress < 1) {
      cameraAnimationId = requestAnimationFrame(animateStep);
    } else {
      cameraAnimationId = null;
    }
  }

  cameraAnimationId = requestAnimationFrame(animateStep);
}

export function enterPreviewMode(mode: string, instant: boolean = false): void {
  if (!isInitialized || previewMode === mode) return;

  if (cameraAnimationId) {
    cancelAnimationFrame(cameraAnimationId);
    cameraAnimationId = null;
  }

  if (!savedEditorCamera) {
    savedEditorCamera = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      fov: (camera as THREE.PerspectiveCamera).fov,
    };
  }

  previewMode = mode as PreviewMode;
  controls.enabled = false;

  buildScene();

  const params = computeCameraParams(state.gamedata, mode as ViewMode) as CameraParams;
  if (instant) {
    camera.position.copy(params.position);
    controls.target.copy(params.target);
    (camera as THREE.PerspectiveCamera).fov = params.fov;
    camera.updateProjectionMatrix();
  } else {
    animateCameraTo(params.position, params.target, params.fov);
  }
}

export function exitPreviewMode(): void {
  if (!isInitialized || !previewMode) return;

  if (cameraAnimationId) {
    cancelAnimationFrame(cameraAnimationId);
    cameraAnimationId = null;
  }

  previewMode = null;
  controls.enabled = true;

  buildScene();

  if (savedEditorCamera) {
    camera.position.copy(savedEditorCamera.position);
    controls.target.copy(savedEditorCamera.target);
    (camera as THREE.PerspectiveCamera).fov = savedEditorCamera.fov;
    camera.updateProjectionMatrix();
    savedEditorCamera = null;
  }
}

export function getPreviewMode(): PreviewMode {
  return previewMode;
}

export function getWireframeMode(): boolean {
  return wireframeMode;
}
