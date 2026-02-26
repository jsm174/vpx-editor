export interface Point {
  x: number;
  y: number;
}

export interface Point3D extends Point {
  z: number;
}

export enum ItemTypeEnum {
  eItemSurface = 0,
  eItemFlipper = 1,
  eItemTimer = 2,
  eItemPlunger = 3,
  eItemTextbox = 4,
  eItemBumper = 5,
  eItemTrigger = 6,
  eItemLight = 7,
  eItemKicker = 8,
  eItemDecal = 9,
  eItemGate = 10,
  eItemSpinner = 11,
  eItemRamp = 12,
  eItemTable = 13,
  eItemLightCenter = 14,
  eItemDragPoint = 15,
  eItemCollection = 16,
  eItemDispReel = 17,
  eItemLightSeq = 18,
  eItemPrimitive = 19,
  eItemFlasher = 20,
  eItemRubber = 21,
  eItemHitTarget = 22,
  eItemBall = 23,
  eItemPartGroup = 24,
  eItemTypeCount = 25,
  eItemInvalid = 0xffffffff,
}

export enum TargetType {
  DropTargetBeveled = 1,
  DropTargetSimple = 2,
  HitTargetRound = 3,
  HitTargetRectangle = 4,
  HitFatTargetRectangle = 5,
  HitFatTargetSquare = 6,
  DropTargetFlatSimple = 7,
  HitFatTargetSlim = 8,
  HitTargetSlim = 9,
}

export enum TriggerShape {
  None = 0,
  WireA = 1,
  Star = 2,
  WireB = 3,
  Button = 4,
  WireC = 5,
  WireD = 6,
  Inder = 7,
}

export enum KickerType {
  Invisible = 0,
  Hole = 1,
  Cup = 2,
  HoleSimple = 3,
  Williams = 4,
  Gottlieb = 5,
  Cup2 = 6,
}

export enum GateType {
  WireW = 1,
  WireRectangle = 2,
  Plate = 3,
  LongPlate = 4,
}

export enum PlungerType {
  Unknown = 0,
  Modern = 1,
  Flat = 2,
  Custom = 3,
}

export enum RampType {
  Flat = 0,
  FourWire = 1,
  TwoWire = 2,
  ThreeWireLeft = 3,
  ThreeWireRight = 4,
  OneWire = 5,
}

export enum DecalType {
  Text = 0,
  Image = 1,
}

export enum ShadowMode {
  None = 0,
  RaytracedBallShadows = 1,
}

export enum Fader {
  None = 0,
  Linear = 1,
  Incandescent = 2,
}

export interface DragPoint {
  x?: number;
  y?: number;
  z?: number;
  vertex?: Point;
  smooth?: boolean;
  is_smooth?: boolean;
  is_slingshot?: boolean;
  has_auto_texture?: boolean;
  tex_coord?: number;
  texture_coord?: number;
  is_locked?: boolean;
  editor_layer?: number;
  editor_layer_name?: string;
  editor_layer_visibility?: boolean;
}

export function getDragPointCoords(p: DragPoint): Point {
  if (p.vertex) {
    return { x: p.vertex.x, y: p.vertex.y };
  }
  return { x: p.x ?? 0, y: p.y ?? 0 };
}

export function setDragPointCoords(p: DragPoint, x: number, y: number): void {
  if (p.vertex) {
    p.vertex.x = x;
    p.vertex.y = y;
  } else {
    p.x = x;
    p.y = y;
  }
}

export function translateDragPoint(p: DragPoint, dx: number, dy: number): void {
  if (p.vertex) {
    p.vertex.x += dx;
    p.vertex.y += dy;
  } else {
    if (p.x !== undefined) p.x += dx;
    if (p.y !== undefined) p.y += dy;
  }
}

export function getDragPointsBounds(
  points: DragPoint[]
): { minX: number; minY: number; maxX: number; maxY: number; centerX: number; centerY: number } | null {
  if (!points || points.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    const { x, y } = getDragPointCoords(p);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

export function translateDragPoints(points: DragPoint[], dx: number, dy: number): void {
  for (const p of points) {
    translateDragPoint(p, dx, dy);
  }
}

export interface GameObject {
  name: string;
  _type: string;
  _fileName: string;
  _layer: number;
  _layerName: string | null;
  is_locked: boolean;
  editor_layer_visibility: boolean;
  part_group_name?: string | null;
  is_backglass?: boolean;
  backglass?: boolean;
  timer_enabled?: boolean;
  timer_interval?: number;
}

export interface Bumper extends GameObject {
  center: Point;
  radius: number;
  height_scale: number;
  orientation: number;
  ring_drop_offset: number;
  ring_speed: number;
  force: number;
  threshold: number;
  scatter: number;
  cap_material: string;
  base_material: string;
  ring_material: string;
  socket_material: string;
  surface?: string;
  is_cap_visible: boolean;
  is_base_visible: boolean;
  is_ring_visible: boolean;
  is_socket_visible: boolean;
  is_reflection_enabled: boolean;
  is_collidable: boolean;
  hit_event: boolean;
}

export interface Flipper extends GameObject {
  center: Point;
  base_radius: number;
  end_radius: number;
  flipper_radius_max: number;
  flipper_radius_min: number;
  height: number;
  start_angle: number;
  end_angle: number;
  rubber_thickness: number;
  rubber_height: number;
  rubber_width: number;
  strength: number;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  ramp_up: number;
  return: number;
  scatter: number;
  mass: number;
  torque_damping: number;
  torque_damping_angle: number;
  material?: string;
  rubber_material?: string;
  surface?: string;
  is_visible: boolean;
  is_reflection_enabled: boolean;
  is_enabled: boolean;
}

export interface Wall extends GameObject {
  drag_points: DragPoint[];
  height_bottom: number;
  height_top: number;
  slingshot_force: number;
  slingshot_threshold: number;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter: number;
  threshold: number;
  disable_lighting_top: number;
  disable_lighting_below: number;
  top_material?: string;
  side_material?: string;
  slingshot_material?: string;
  image?: string;
  is_top_bottom_visible: boolean;
  is_side_visible: boolean;
  is_droppable: boolean;
  is_collidable: boolean;
  slingshot_animation: boolean;
  display_texture: boolean;
}

export interface Light extends GameObject {
  center: Point;
  falloff: number;
  falloff_power: number;
  intensity: number;
  state: number;
  color: string;
  color2?: string;
  mesh_radius: number;
  bulb_halo_height: number;
  bulb_modulate_vs_add: number;
  transmission_scale: number;
  fade_speed_up: number;
  fade_speed_down: number;
  blink_pattern: string;
  blink_interval: number;
  depth_bias: number;
  surface?: string;
  image?: string;
  drag_points?: DragPoint[];
  is_round_light: boolean;
  is_backglass?: boolean;
  show_bulb_mesh: boolean;
  show_reflection_on_ball: boolean;
  static_bulb_mesh: boolean;
  height?: number;
  shadows?: ShadowMode;
  fader?: Fader;
  is_visible?: boolean;
  is_bulb_light?: boolean;
  is_image_mode?: boolean;
}

export interface Primitive extends GameObject {
  position: Point3D;
  size: Point3D;
  rot_and_tra: number[];
  sides: number;
  alpha: number;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter: number;
  threshold: number;
  collision_reduction_factor: number;
  depth_bias: number;
  disable_lighting_top: number;
  disable_lighting_below: number;
  reflection_strength: number;
  refraction_thickness: number;
  edge_factor_ui: number;
  material?: string;
  physics_material?: string;
  image?: string;
  normal_map?: string;
  mesh?: string;
  use_as_playfield: boolean;
  is_visible: boolean;
  static_rendering: boolean;
  is_reflection_enabled: boolean;
  is_toy: boolean;
  is_collidable: boolean;
  hit_event: boolean;
  overwrite_physics: boolean;
  display_texture: boolean;
  object_space_normal_map: boolean;
  backfaces_enabled: boolean;
  add_blend: boolean;
  color?: string;
  use_depth_mask?: boolean;
  light_map?: string;
  reflection_probe?: string;
  refraction_probe?: string;
}

export interface Ramp extends GameObject {
  drag_points: DragPoint[];
  height_bottom: number;
  height_top: number;
  width_bottom: number;
  width_top: number;
  left_wall_height: number;
  left_wall_height_visible: number;
  right_wall_height: number;
  right_wall_height_visible: number;
  wire_diameter: number;
  wire_distance_x: number;
  wire_distance_y: number;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter: number;
  threshold: number;
  depth_bias: number;
  ramp_type: number;
  material?: string;
  physics_material?: string;
  image?: string;
  image_alignment: number;
  is_visible: boolean;
  is_reflection_enabled: boolean;
  is_collidable: boolean;
  hit_event: boolean;
  overwrite_physics: boolean;
}

export interface Trigger extends GameObject {
  center: Point;
  radius: number;
  rotation: number;
  scale_x: number;
  scale_y: number;
  hit_height: number;
  anim_speed: number;
  wire_thickness: number;
  shape: number;
  material?: string;
  surface?: string;
  drag_points?: DragPoint[];
  is_visible: boolean;
  is_reflection_enabled: boolean;
  is_enabled: boolean;
}

export interface Kicker extends GameObject {
  center: Point;
  radius: number;
  orientation: number;
  hit_height: number;
  hit_accuracy: number;
  scatter: number;
  kicker_type: number;
  material?: string;
  surface?: string;
  is_enabled: boolean;
  fall_through: boolean;
  legacy_mode: boolean;
}

export interface Gate extends GameObject {
  center: Point;
  length: number;
  height: number;
  rotation: number;
  elasticity: number;
  friction: number;
  damping: number;
  gravity_factor: number;
  open_angle: number;
  close_angle: number;
  gate_type: number;
  material?: string;
  surface?: string;
  is_visible: boolean;
  is_reflection_enabled: boolean;
  is_collidable: boolean;
  two_way: boolean;
  show_bracket: boolean;
}

export interface Spinner extends GameObject {
  center: Point;
  length: number;
  height: number;
  rotation: number;
  damping: number;
  elasticity: number;
  angle_max: number;
  angle_min: number;
  material?: string;
  image?: string;
  surface?: string;
  is_visible: boolean;
  is_reflection_enabled: boolean;
  show_bracket: boolean;
}

export interface HitTarget extends GameObject {
  position: Point3D;
  size: Point3D;
  rot_z: number;
  drop_speed: number;
  raise_delay: number;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter: number;
  threshold: number;
  depth_bias: number;
  disable_lighting_top: number;
  disable_lighting_below: number;
  target_type: number;
  material?: string;
  physics_material?: string;
  image?: string;
  is_visible: boolean;
  is_reflection_enabled: boolean;
  is_collidable: boolean;
  is_dropped: boolean;
  is_drop_target: boolean;
  legacy_mode: boolean;
  use_hit_event: boolean;
  overwrite_physics: boolean;
}

export interface Plunger extends GameObject {
  center: Point;
  width: number;
  height: number;
  z_adjust: number;
  stroke: number;
  speed_pull: number;
  speed_fire: number;
  mech_strength: number;
  momentum_xfer: number;
  scatter_velocity: number;
  park_position: number;
  rod_diam: number;
  ring_gap: number;
  ring_diam: number;
  ring_width: number;
  spring_diam: number;
  spring_gauge: number;
  spring_loops: number;
  spring_end_loops: number;
  anim_frames: number;
  plunger_type: number;
  material?: string;
  image?: string;
  surface?: string;
  tip_shape?: string;
  is_visible: boolean;
  is_reflection_enabled: boolean;
  auto_plunger: boolean;
  mech_plunger: boolean;
}

export interface Rubber extends GameObject {
  drag_points: DragPoint[];
  height: number;
  hit_height: number;
  thickness: number;
  rot_x: number;
  rot_y: number;
  rot_z: number;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter: number;
  material?: string;
  physics_material?: string;
  image?: string;
  is_visible: boolean;
  static_rendering: boolean;
  is_reflection_enabled: boolean;
  is_collidable: boolean;
  hit_event: boolean;
  overwrite_physics: boolean;
}

export interface Decal extends GameObject {
  center: Point;
  vCenter?: Point;
  width: number;
  height: number;
  rotation: number;
  image?: string;
  material?: string;
  surface?: string;
  decal_type: number | 'image' | 'text' | string;
  text?: string;
  sizing_type: number | 'auto_size' | 'auto_width' | 'manual_size' | string;
  font?: {
    name: string;
    size: number;
    weight: number;
    italic: boolean;
  };
  font_color?: string;
  color?: string;
  is_vertical_text: boolean;
  vertical_text?: boolean;
}

export interface Flasher extends GameObject {
  center: Point;
  height: number;
  size: number;
  alpha: number;
  color: number | string;
  modulate_vs_add: number;
  filter_amount: number;
  depth_bias: number;
  render_style: number;
  render_mode?: 'flasher' | 'dmd' | 'display' | 'alpha_seg' | string;
  image_a?: string;
  image_b?: string;
  image_src_link?: string;
  image_alignment?: 'world' | 'wrap' | string;
  filter?: 'none' | 'additive' | 'overlay' | 'multiply' | 'screen' | string;
  light_map?: string;
  glass_roughness?: number;
  glass_ambient?: number;
  glass_pad_top?: number;
  glass_pad_bottom?: number;
  glass_pad_left?: number;
  glass_pad_right?: number;
  drag_points?: DragPoint[];
  is_visible: boolean;
  is_add_blend: boolean;
  add_blend?: boolean;
  is_dmd: boolean;
  display_texture: boolean;
  pos_x?: number;
  pos_y?: number;
  rot_x?: number;
  rot_y?: number;
  rot_z?: number;
  is_timer_enabled?: boolean;
  timer_interval?: number;
}

export interface TextBox extends GameObject {
  v1: Point;
  v2: Point;
  back_color: string;
  font_color: string;
  intensity_scale: number;
  text?: string;
  font?: {
    name: string;
    size: number;
    weight: number;
    italic: boolean;
  };
  align: number;
  is_transparent: boolean;
  is_dmd: boolean;
}

export interface Reel extends GameObject {
  v1: Point;
  v2: Point;
  width: number;
  height: number;
  reel_spacing: number;
  reel_count: number;
  digit_range: number;
  motor_steps: number;
  update_interval: number;
  images_per_grid_row: number;
  back_color: string;
  image?: string;
  sound?: string;
  is_visible: boolean;
  is_transparent: boolean;
  use_image_grid: boolean;
}

export interface Timer extends GameObject {
  center: Point;
  vCenter?: Point;
  interval?: number;
  timer_interval?: number;
  is_timer_enabled: boolean;
}

export interface LightSequencer extends GameObject {
  center: Point;
  pos_x: number;
  pos_y: number;
  update_interval: number;
  timer_interval?: number;
  is_timer_enabled?: boolean;
  collection?: string;
}

export interface PartGroup extends GameObject {
  position: Point3D;
  size: Point3D;
  rot_and_tra: number[];
  player_mode_visibility_mask: number;
  space_reference?: string;
}

export interface Ball extends GameObject {
  center?: Point;
  radius: number;
  mass: number;
  bulb_intensity_scale: number;
  playfield_reflection_strength: number;
  front_decal?: string;
  decal_mode: number;
  is_visible: boolean;
  is_reflection_enabled: boolean;
  is_timer_enabled?: boolean;
  timer_interval?: number;
}

export type AnyGameObject =
  | Bumper
  | Flipper
  | Wall
  | Light
  | Primitive
  | Ramp
  | Trigger
  | Kicker
  | Gate
  | Spinner
  | HitTarget
  | Plunger
  | Rubber
  | Decal
  | Flasher
  | TextBox
  | Reel
  | Timer
  | LightSequencer
  | PartGroup
  | Ball;

export type ObjectType =
  | 'Ball'
  | 'Bumper'
  | 'Decal'
  | 'Flasher'
  | 'Flipper'
  | 'Gate'
  | 'HitTarget'
  | 'Kicker'
  | 'Light'
  | 'LightSequencer'
  | 'PartGroup'
  | 'Plunger'
  | 'Primitive'
  | 'Ramp'
  | 'Reel'
  | 'Rubber'
  | 'Spinner'
  | 'TextBox'
  | 'Timer'
  | 'Trigger'
  | 'Wall';

const typeNameToEnum: Record<string, ItemTypeEnum> = {
  Wall: ItemTypeEnum.eItemSurface,
  Flipper: ItemTypeEnum.eItemFlipper,
  Timer: ItemTypeEnum.eItemTimer,
  Plunger: ItemTypeEnum.eItemPlunger,
  TextBox: ItemTypeEnum.eItemTextbox,
  Bumper: ItemTypeEnum.eItemBumper,
  Trigger: ItemTypeEnum.eItemTrigger,
  Light: ItemTypeEnum.eItemLight,
  Kicker: ItemTypeEnum.eItemKicker,
  Decal: ItemTypeEnum.eItemDecal,
  Gate: ItemTypeEnum.eItemGate,
  Spinner: ItemTypeEnum.eItemSpinner,
  Ramp: ItemTypeEnum.eItemRamp,
  Reel: ItemTypeEnum.eItemDispReel,
  LightSequencer: ItemTypeEnum.eItemLightSeq,
  Primitive: ItemTypeEnum.eItemPrimitive,
  Flasher: ItemTypeEnum.eItemFlasher,
  Rubber: ItemTypeEnum.eItemRubber,
  HitTarget: ItemTypeEnum.eItemHitTarget,
  Ball: ItemTypeEnum.eItemBall,
  PartGroup: ItemTypeEnum.eItemPartGroup,
};

const enumToTypeName: Record<number, string> = {
  [ItemTypeEnum.eItemSurface]: 'Wall',
  [ItemTypeEnum.eItemFlipper]: 'Flipper',
  [ItemTypeEnum.eItemTimer]: 'Timer',
  [ItemTypeEnum.eItemPlunger]: 'Plunger',
  [ItemTypeEnum.eItemTextbox]: 'TextBox',
  [ItemTypeEnum.eItemBumper]: 'Bumper',
  [ItemTypeEnum.eItemTrigger]: 'Trigger',
  [ItemTypeEnum.eItemLight]: 'Light',
  [ItemTypeEnum.eItemKicker]: 'Kicker',
  [ItemTypeEnum.eItemDecal]: 'Decal',
  [ItemTypeEnum.eItemGate]: 'Gate',
  [ItemTypeEnum.eItemSpinner]: 'Spinner',
  [ItemTypeEnum.eItemRamp]: 'Ramp',
  [ItemTypeEnum.eItemDispReel]: 'Reel',
  [ItemTypeEnum.eItemLightSeq]: 'LightSequencer',
  [ItemTypeEnum.eItemPrimitive]: 'Primitive',
  [ItemTypeEnum.eItemFlasher]: 'Flasher',
  [ItemTypeEnum.eItemRubber]: 'Rubber',
  [ItemTypeEnum.eItemHitTarget]: 'HitTarget',
  [ItemTypeEnum.eItemBall]: 'Ball',
  [ItemTypeEnum.eItemPartGroup]: 'PartGroup',
};

export function getItemType(typeName: string): ItemTypeEnum {
  return typeNameToEnum[typeName] ?? ItemTypeEnum.eItemInvalid;
}

export function getTypeName(itemType: ItemTypeEnum): string | undefined {
  return enumToTypeName[itemType];
}

export interface GameItemBase {
  name?: string;
  _type?: string;
  _fileName?: string;
  _layer?: number;
  _layerName?: string | null;
  is_locked?: boolean;
  editor_layer_visibility?: boolean;
  part_group_name?: string | null;
  is_backglass?: boolean;
  backglass?: boolean;
  center?: Point;
  vCenter?: Point;
  pos?: Point;
  position?: Point3D;
  pos_x?: number;
  pos_y?: number;
  ver1?: Point;
  ver2?: Point;
  drag_points?: DragPoint[];
  radius?: number;
  falloff_radius?: number;
  size?: Point3D;
  [key: string]: unknown;
}

export interface GameItemMeta {
  file_name: string;
  editor_layer: number;
  editor_layer_name: string | null;
  is_locked: boolean;
  editor_layer_visibility?: boolean;
}
