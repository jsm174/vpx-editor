import type { Point, Point3D as Point3DType, DragPoint } from '../types/game-objects.js';

const RAMP_DEFAULT_LENGTH = 400.0;

type Point2D = Point;
type Point3D = Point3DType;

interface Size3D {
  x: number;
  y: number;
  z: number;
}

interface Font {
  name: string;
  size: number;
  weight: number;
  style: string[];
}

interface LightDefaults {
  center: Point2D;
  height: number;
  falloff_radius: number;
  falloff_power: number;
  state_u32: number;
  state: number;
  color: string;
  color2: string;
  is_timer_enabled: boolean;
  timer_interval: number;
  blink_pattern: string;
  off_image: string;
  blink_interval: number;
  intensity: number;
  transmission_scale: number;
  surface: string;
  is_backglass: boolean;
  depth_bias: number;
  fade_speed_up: number;
  fade_speed_down: number;
  is_bulb_light: boolean;
  is_image_mode: boolean;
  show_bulb_mesh: boolean;
  has_static_bulb_mesh: boolean;
  show_reflection_on_ball: boolean;
  mesh_radius: number;
  bulb_modulate_vs_add: number;
  bulb_halo_height: number;
  visible: boolean;
  is_locked: boolean;
}

interface FlipperDefaults {
  center: Point2D;
  base_radius: number;
  end_radius: number;
  flipper_radius_max: number;
  flipper_radius_min: number;
  return_: number;
  start_angle: number;
  end_angle: number;
  override_physics: number;
  mass: number;
  is_timer_enabled: boolean;
  timer_interval: number;
  surface: string;
  material: string;
  rubber_material: string;
  rubber_thickness_int: number;
  rubber_thickness: number;
  rubber_height_int: number;
  rubber_height: number;
  rubber_width_int: number;
  rubber_width: number;
  strength: number;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  ramp_up: number;
  scatter: number;
  torque_damping: number;
  torque_damping_angle: number;
  is_visible: boolean;
  is_enabled: boolean;
  height: number;
  image: string;
  is_reflection_enabled: boolean;
  is_locked: boolean;
}

interface BumperDefaults {
  center: Point2D;
  radius: number;
  is_timer_enabled: boolean;
  timer_interval: number;
  threshold: number;
  force: number;
  scatter: number;
  height_scale: number;
  ring_speed: number;
  orientation: number;
  ring_drop_offset: number;
  cap_material: string;
  base_material: string;
  socket_material: string;
  ring_material: string;
  surface: string;
  is_cap_visible: boolean;
  is_base_visible: boolean;
  is_ring_visible: boolean;
  is_socket_visible: boolean;
  hit_event: boolean;
  is_collidable: boolean;
  is_reflection_enabled: boolean;
  is_locked: boolean;
}

interface KickerDefaults {
  center: Point2D;
  radius: number;
  is_timer_enabled: boolean;
  timer_interval: number;
  is_enabled: boolean;
  hit_accuracy: number;
  orientation: number;
  surface: string;
  material: string;
  kicker_type: string;
  scatter: number;
  hit_height: number;
  fall_through: boolean;
  legacy_mode: boolean;
  is_locked: boolean;
}

interface WallDefaults {
  height_bottom: number;
  height_top: number;
  image: string;
  side_image: string;
  side_material: string;
  top_material: string;
  slingshot_material: string;
  is_timer_enabled: boolean;
  timer_interval: number;
  threshold: number;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter: number;
  is_top_bottom_visible: boolean;
  is_side_visible: boolean;
  display_texture: boolean;
  is_droppable: boolean;
  is_flipbook: boolean;
  is_bottom_solid: boolean;
  is_collidable: boolean;
  hit_event: boolean;
  disable_lighting_top_old: number;
  disable_lighting_below: number;
  is_reflection_enabled: boolean;
  physics_material: string;
  overwrite_physics: boolean;
  slingshot_force: number;
  slingshot_threshold: number;
  slingshot_animation: boolean;
  drag_points: DragPoint[];
  is_locked: boolean;
}

interface RubberDefaults {
  height: number;
  hit_height: number;
  thickness: number;
  is_timer_enabled: boolean;
  timer_interval: number;
  image: string;
  material: string;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter: number;
  is_collidable: boolean;
  is_visible: boolean;
  hit_event: boolean;
  is_reflection_enabled: boolean;
  physics_material: string;
  overwrite_physics: boolean;
  static_rendering: boolean;
  show_in_editor: boolean;
  rot_x: number;
  rot_y: number;
  rot_z: number;
  drag_points: DragPoint[];
  is_locked: boolean;
}

interface RampDefaults {
  height_bottom: number;
  height_top: number;
  height_wall: number;
  width_bottom: number;
  width_top: number;
  material: string;
  is_timer_enabled: boolean;
  timer_interval: number;
  ramp_type: string;
  image: string;
  image_alignment: string;
  image_walls: boolean;
  left_wall_height: number;
  right_wall_height: number;
  left_wall_height_visible: number;
  right_wall_height_visible: number;
  hit_event: boolean;
  threshold: number;
  elasticity: number;
  friction: number;
  scatter: number;
  is_collidable: boolean;
  is_visible: boolean;
  depth_bias: number;
  wire_diameter: number;
  wire_distance_x: number;
  wire_distance_y: number;
  is_reflection_enabled: boolean;
  physics_material: string;
  overwrite_physics: boolean;
  is_locked: boolean;
}

interface GateDefaults {
  center: Point2D;
  length: number;
  height: number;
  rotation: number;
  is_timer_enabled: boolean;
  timer_interval: number;
  surface: string;
  material: string;
  is_collidable: boolean;
  is_visible: boolean;
  show_bracket: boolean;
  angle_max: number;
  angle_min: number;
  damping: number;
  gravity_factor: number;
  two_way: boolean;
  is_reflection_enabled: boolean;
  elasticity: number;
  friction: number;
  gate_type: string;
  is_locked: boolean;
}

interface SpinnerDefaults {
  center: Point2D;
  rotation: number;
  is_timer_enabled: boolean;
  timer_interval: number;
  height: number;
  length: number;
  damping: number;
  angle_max: number;
  angle_min: number;
  elasticity: number;
  is_visible: boolean;
  show_bracket: boolean;
  material: string;
  image: string;
  surface: string;
  is_reflection_enabled: boolean;
  is_locked: boolean;
}

interface HitTargetDefaults {
  position: Point3D;
  size: Size3D;
  rot_z: number;
  image: string;
  material: string;
  is_timer_enabled: boolean;
  timer_interval: number;
  target_type: string;
  is_visible: boolean;
  is_legacy: boolean;
  use_hit_event: boolean;
  threshold: number;
  is_dropped: boolean;
  drop_speed: number;
  raise_delay: number;
  depth_bias: number;
  disable_lighting_top_old: number;
  disable_lighting_below: number;
  is_collidable: boolean;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter: number;
  physics_material: string;
  overwrite_physics: boolean;
  is_reflection_enabled: boolean;
  is_locked: boolean;
}

interface TriggerDefaults {
  center: Point2D;
  radius: number;
  rotation: number;
  wire_thickness: number;
  scale_x: number;
  scale_y: number;
  surface: string;
  is_timer_enabled: boolean;
  timer_interval: number;
  is_enabled: boolean;
  is_visible: boolean;
  material: string;
  hit_height: number;
  shape: string;
  anim_speed: number;
  is_reflection_enabled: boolean;
  drag_points: DragPoint[];
  is_locked: boolean;
}

interface PlungerDefaults {
  center: Point2D;
  width: number;
  height: number;
  z_adjust: number;
  stroke: number;
  speed_pull: number;
  speed_fire: number;
  plunger_type: string;
  anim_frames: number;
  material: string;
  image: string;
  mech_strength: number;
  is_mech_plunger: boolean;
  auto_plunger: boolean;
  park_position: number;
  scatter_velocity: number;
  momentum_xfer: number;
  is_timer_enabled: boolean;
  timer_interval: number;
  is_visible: boolean;
  is_reflection_enabled: boolean;
  surface: string;
  tip_shape: string;
  rod_diam: number;
  ring_gap: number;
  ring_diam: number;
  ring_width: number;
  spring_diam: number;
  spring_gauge: number;
  spring_loops: number;
  spring_end_loops: number;
  is_locked: boolean;
}

interface FlasherDefaults {
  height: number;
  pos_x: number;
  pos_y: number;
  rot_x: number;
  rot_y: number;
  rot_z: number;
  color: string;
  is_timer_enabled: boolean;
  timer_interval: number;
  image_a: string;
  image_b: string;
  filter: string;
  filter_amount: number;
  alpha: number;
  add_blend: boolean;
  is_dmd: boolean;
  display_texture: boolean;
  depth_bias: number;
  image_alignment: string;
  modulate_vs_add: number;
  is_visible: boolean;
  drag_points: DragPoint[];
  is_locked: boolean;
}

interface TimerDefaults {
  center: Point2D;
  is_timer_enabled: boolean;
  timer_interval: number;
  backglass: boolean;
  is_locked: boolean;
}

interface DecalDefaults {
  center: Point2D;
  width: number;
  height: number;
  rotation: number;
  image: string;
  surface: string;
  decal_type: string;
  text: string;
  sizing_type: string;
  material: string;
  font: Font;
  color: string;
  vertical_text: boolean;
  backglass: boolean;
  is_locked: boolean;
}

interface TextBoxDefaults {
  ver1: Point2D;
  ver2: Point2D;
  back_color: string;
  font_color: string;
  intensity_scale: number;
  text: string;
  is_timer_enabled: boolean;
  timer_interval: number;
  is_dmd: boolean;
  font: Font;
  align: string;
  is_transparent: boolean;
  is_locked: boolean;
}

interface PrimitiveDefaults {
  position: Point3D;
  size: Size3D;
  rot_and_tra: number[];
  image: string;
  normal_map: string;
  sides: number;
  material: string;
  side_color: string;
  is_visible: boolean;
  draw_textures_inside: boolean;
  hit_event: boolean;
  threshold: number;
  elasticity: number;
  elasticity_falloff: number;
  friction: number;
  scatter: number;
  edge_factor_ui: number;
  collision_reduction_factor: number;
  is_collidable: boolean;
  is_toy: boolean;
  use_3d_mesh: boolean;
  static_rendering: boolean;
  disable_lighting_top_old: number;
  disable_lighting_below: number;
  is_reflection_enabled: boolean;
  backfaces_enabled: boolean;
  physics_material: string;
  overwrite_physics: boolean;
  display_texture: boolean;
  object_space_normal_map: boolean;
  mesh_file_name: string;
  depth_bias: number;
  add_blend: boolean;
  use_depth_mask: boolean;
  alpha: number;
  color: string;
  is_locked: boolean;
}

interface BallDefaults {
  pos: Point3D;
  radius: number;
  mass: number;
  is_visible: boolean;
  is_reflection_enabled: boolean;
  force_reflection: boolean;
  color: string;
  image: string;
  image_decal: string;
  spherical_mapping: boolean;
  decal_mode: boolean;
  playfield_reflection_strength: number;
  bulb_intensity_scale: number;
  is_timer_enabled: boolean;
  timer_interval: number;
  is_locked: boolean;
}

interface ReelDefaults {
  ver1: Point2D;
  ver2: Point2D;
  back_color: string;
  is_timer_enabled: boolean;
  timer_interval: number;
  is_transparent: boolean;
  image: string;
  sound: string;
  width: number;
  height: number;
  reel_count: number;
  reel_spacing: number;
  motor_steps: number;
  digit_range: number;
  update_interval: number;
  use_image_grid: boolean;
  is_visible: boolean;
  images_per_grid_row: number;
  is_locked: boolean;
}

interface LightSequencerDefaults {
  center: Point2D;
  pos_x: number;
  pos_y: number;
  collection: string;
  update_interval: number;
  is_timer_enabled: boolean;
  timer_interval: number;
  backglass: boolean;
  is_locked: boolean;
}

type ObjectDefaults =
  | LightDefaults
  | FlipperDefaults
  | BumperDefaults
  | KickerDefaults
  | WallDefaults
  | RubberDefaults
  | RampDefaults
  | GateDefaults
  | SpinnerDefaults
  | HitTargetDefaults
  | TriggerDefaults
  | PlungerDefaults
  | FlasherDefaults
  | TimerDefaults
  | DecalDefaults
  | TextBoxDefaults
  | PrimitiveDefaults
  | BallDefaults
  | ReelDefaults
  | LightSequencerDefaults;

interface ObjectTypeDefinition {
  hasDragPoints?: boolean;
  dragPointColor?: string;
  dragPointFirstColor?: string;
  createDragPoints?: (center: Point2D, defaults: ObjectDefaults) => DragPoint[];
  defaults: ObjectDefaults;
}

type ObjectTypes = Record<string, ObjectTypeDefinition>;

export const objectTypes: ObjectTypes = {
  Light: {
    dragPointColor: '#0000c8',
    createDragPoints: (center: Point2D, defaults: ObjectDefaults): DragPoint[] => {
      const points: DragPoint[] = [];
      const falloff = (defaults as LightDefaults).falloff_radius || 50;
      for (let i = 8; i > 0; i--) {
        const angle = ((Math.PI * 2) / 8) * i;
        points.push({
          x: center.x + Math.sin(angle) * falloff,
          y: center.y - Math.cos(angle) * falloff,
          z: 0,
          smooth: true,
          has_auto_texture: false,
          tex_coord: 0,
          is_locked: false,
          editor_layer: 0,
        });
      }
      return points;
    },
    defaults: {
      center: { x: 0, y: 0 },
      height: 28.0,
      falloff_radius: 50.0,
      falloff_power: 2.0,
      state_u32: 0,
      state: 0.0,
      color: '#ffa957',
      color2: '#ffa957',
      is_timer_enabled: false,
      timer_interval: 100,
      blink_pattern: '10',
      off_image: '',
      blink_interval: 125,
      intensity: 10.0,
      transmission_scale: 0.0,
      surface: '',
      is_backglass: false,
      depth_bias: 0.0,
      fade_speed_up: 0.05,
      fade_speed_down: 0.02,
      is_bulb_light: false,
      is_image_mode: false,
      show_bulb_mesh: false,
      has_static_bulb_mesh: true,
      show_reflection_on_ball: true,
      mesh_radius: 20.0,
      bulb_modulate_vs_add: 0.9,
      bulb_halo_height: 28.0,
      visible: true,
      is_locked: false,
    },
  },

  Flipper: {
    defaults: {
      center: { x: 0, y: 0 },
      base_radius: 21.5,
      end_radius: 13.0,
      flipper_radius_max: 130.0,
      flipper_radius_min: 0.0,
      return_: 0.058,
      start_angle: 121.0,
      end_angle: 70.0,
      override_physics: 0,
      mass: 1.0,
      is_timer_enabled: false,
      timer_interval: 100,
      surface: '',
      material: '',
      rubber_material: '',
      rubber_thickness_int: 7,
      rubber_thickness: 7.0,
      rubber_height_int: 19,
      rubber_height: 19.0,
      rubber_width_int: 24,
      rubber_width: 24.0,
      strength: 2200.0,
      elasticity: 0.8,
      elasticity_falloff: 0.43,
      friction: 0.6,
      ramp_up: 3.0,
      scatter: 0.0,
      torque_damping: 0.75,
      torque_damping_angle: 6.0,
      is_visible: true,
      is_enabled: true,
      height: 50.0,
      image: '',
      is_reflection_enabled: true,
      is_locked: false,
    },
  },

  Bumper: {
    defaults: {
      center: { x: 0, y: 0 },
      radius: 45.0,
      is_timer_enabled: false,
      timer_interval: 100,
      threshold: 1.0,
      force: 15.0,
      scatter: 0.0,
      height_scale: 90.0,
      ring_speed: 0.5,
      orientation: 0.0,
      ring_drop_offset: 0.0,
      cap_material: '',
      base_material: '',
      socket_material: '',
      ring_material: '',
      surface: '',
      is_cap_visible: true,
      is_base_visible: true,
      is_ring_visible: true,
      is_socket_visible: true,
      hit_event: true,
      is_collidable: true,
      is_reflection_enabled: true,
      is_locked: false,
    },
  },

  Kicker: {
    defaults: {
      center: { x: 0, y: 0 },
      radius: 25.0,
      is_timer_enabled: false,
      timer_interval: 100,
      is_enabled: true,
      hit_accuracy: 0.5,
      orientation: 0.0,
      surface: '',
      material: '',
      kicker_type: 'hole',
      scatter: 0.0,
      hit_height: 35.0,
      fall_through: false,
      legacy_mode: true,
      is_locked: false,
    },
  },

  Wall: {
    hasDragPoints: true,
    dragPointColor: '#ff0000',
    defaults: {
      height_bottom: 0.0,
      height_top: 50.0,
      image: '',
      side_image: '',
      side_material: '',
      top_material: '',
      slingshot_material: '',
      is_timer_enabled: false,
      timer_interval: 100,
      threshold: 2.0,
      elasticity: 0.3,
      elasticity_falloff: 0.0,
      friction: 0.3,
      scatter: 0.0,
      is_top_bottom_visible: true,
      is_side_visible: true,
      display_texture: false,
      is_droppable: false,
      is_flipbook: false,
      is_bottom_solid: false,
      is_collidable: true,
      hit_event: false,
      disable_lighting_top_old: 0.0,
      disable_lighting_below: 1.0,
      is_reflection_enabled: true,
      physics_material: '',
      overwrite_physics: true,
      slingshot_force: 80.0,
      slingshot_threshold: 0.0,
      slingshot_animation: true,
      drag_points: [
        {
          x: -50,
          y: -50,
          z: 0,
          smooth: false,
          is_slingshot: false,
          has_auto_texture: true,
          tex_coord: 0,
          is_locked: false,
          editor_layer: 0,
        },
        {
          x: -50,
          y: 50,
          z: 0,
          smooth: false,
          is_slingshot: false,
          has_auto_texture: true,
          tex_coord: 0,
          is_locked: false,
          editor_layer: 0,
        },
        {
          x: 50,
          y: 50,
          z: 0,
          smooth: false,
          is_slingshot: false,
          has_auto_texture: true,
          tex_coord: 0,
          is_locked: false,
          editor_layer: 0,
        },
        {
          x: 50,
          y: -50,
          z: 0,
          smooth: false,
          is_slingshot: false,
          has_auto_texture: true,
          tex_coord: 0,
          is_locked: false,
          editor_layer: 0,
        },
      ],
      is_locked: false,
    },
  },

  Rubber: {
    hasDragPoints: true,
    dragPointColor: '#ff0000',
    defaults: {
      height: 25.0,
      hit_height: 25.0,
      thickness: 8,
      is_timer_enabled: false,
      timer_interval: 100,
      image: '',
      material: '',
      elasticity: 0.8,
      elasticity_falloff: 0.3,
      friction: 0.6,
      scatter: 5.0,
      is_collidable: true,
      is_visible: true,
      hit_event: false,
      is_reflection_enabled: true,
      physics_material: '',
      overwrite_physics: true,
      static_rendering: true,
      show_in_editor: false,
      rot_x: 0.0,
      rot_y: 0.0,
      rot_z: 0.0,
      drag_points: [
        { x: 0, y: -50, z: 0, smooth: true, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: -35.36, y: -35.36, z: 0, smooth: true, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: -50, y: 0, z: 0, smooth: true, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: -35.36, y: 35.36, z: 0, smooth: true, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: 0, y: 50, z: 0, smooth: true, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: 35.36, y: 35.36, z: 0, smooth: true, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: 50, y: 0, z: 0, smooth: true, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: 35.36, y: -35.36, z: 0, smooth: true, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
      ],
      is_locked: false,
    },
  },

  Ramp: {
    hasDragPoints: true,
    dragPointColor: '#ff0000',
    dragPointFirstColor: '#0000ff',
    createDragPoints: (center: Point2D, defaults: ObjectDefaults): DragPoint[] => {
      const rampDefaults = defaults as RampDefaults;
      const halfLength = RAMP_DEFAULT_LENGTH * 0.5;
      return [
        {
          x: center.x,
          y: center.y + halfLength,
          z: rampDefaults.height_bottom,
          smooth: true,
          is_slingshot: false,
          has_auto_texture: true,
          tex_coord: 0,
        },
        {
          x: center.x,
          y: center.y - halfLength,
          z: rampDefaults.height_top,
          smooth: true,
          is_slingshot: false,
          has_auto_texture: true,
          tex_coord: 0,
        },
      ];
    },
    defaults: {
      height_bottom: 0.0,
      height_top: 50.0,
      height_wall: 32.0,
      width_bottom: 75.0,
      width_top: 60.0,
      material: '',
      is_timer_enabled: false,
      timer_interval: 100,
      ramp_type: 'flat',
      image: '',
      image_alignment: 'world',
      image_walls: true,
      left_wall_height: 62.0,
      right_wall_height: 62.0,
      left_wall_height_visible: 30.0,
      right_wall_height_visible: 30.0,
      hit_event: false,
      threshold: 2.0,
      elasticity: 0.3,
      friction: 0.3,
      scatter: 0.0,
      is_collidable: true,
      is_visible: true,
      depth_bias: 0.0,
      wire_diameter: 8.0,
      wire_distance_x: 38.0,
      wire_distance_y: 88.0,
      is_reflection_enabled: true,
      physics_material: '',
      overwrite_physics: true,
      is_locked: false,
    },
  },

  Gate: {
    defaults: {
      center: { x: 0, y: 0 },
      length: 100.0,
      height: 50.0,
      rotation: -90.0,
      is_timer_enabled: false,
      timer_interval: 100,
      surface: '',
      material: '',
      is_collidable: true,
      is_visible: true,
      show_bracket: true,
      angle_max: 0.0,
      angle_min: 90.0,
      damping: 0.985,
      gravity_factor: 0.25,
      two_way: true,
      is_reflection_enabled: true,
      elasticity: 0.3,
      friction: 0.02,
      gate_type: 'wire_w',
      is_locked: false,
    },
  },

  Spinner: {
    defaults: {
      center: { x: 0, y: 0 },
      rotation: 0.0,
      is_timer_enabled: false,
      timer_interval: 100,
      height: 60.0,
      length: 80.0,
      damping: 0.9879,
      angle_max: 0.0,
      angle_min: 0.3,
      elasticity: 0.3,
      is_visible: true,
      show_bracket: true,
      material: '',
      image: '',
      surface: '',
      is_reflection_enabled: true,
      is_locked: false,
    },
  },

  HitTarget: {
    defaults: {
      position: { x: 0, y: 0, z: 0 },
      size: { x: 32, y: 32, z: 32 },
      rot_z: 0.0,
      image: '',
      material: '',
      is_timer_enabled: false,
      timer_interval: 100,
      target_type: 'drop_target_simple',
      is_visible: true,
      is_legacy: false,
      use_hit_event: true,
      threshold: 2.0,
      is_dropped: false,
      drop_speed: 0.2,
      raise_delay: 100,
      depth_bias: 0.0,
      disable_lighting_top_old: 0.0,
      disable_lighting_below: 1.0,
      is_collidable: true,
      elasticity: 0.35,
      elasticity_falloff: 0.5,
      friction: 0.2,
      scatter: 5.0,
      physics_material: '',
      overwrite_physics: true,
      is_reflection_enabled: true,
      is_locked: false,
    },
  },

  Trigger: {
    hasDragPoints: true,
    dragPointColor: '#00b400',
    defaults: {
      center: { x: 0, y: 0 },
      radius: 25.0,
      rotation: 0.0,
      wire_thickness: 0.0,
      scale_x: 1.0,
      scale_y: 1.0,
      surface: '',
      is_timer_enabled: false,
      timer_interval: 100,
      is_enabled: true,
      is_visible: true,
      material: '',
      hit_height: 50.0,
      shape: 'wire_a',
      anim_speed: 1.0,
      is_reflection_enabled: true,
      drag_points: [
        { x: -30, y: -30, z: 0, smooth: false, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: -30, y: 30, z: 0, smooth: false, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: 30, y: 30, z: 0, smooth: false, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: 30, y: -30, z: 0, smooth: false, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
      ],
      is_locked: false,
    },
  },

  Plunger: {
    defaults: {
      center: { x: 0, y: 0 },
      width: 25.0,
      height: 20.0,
      z_adjust: 0.0,
      stroke: 80.0,
      speed_pull: 5.0,
      speed_fire: 80.0,
      plunger_type: 'modern',
      anim_frames: 1,
      material: '',
      image: '',
      mech_strength: 85.0,
      is_mech_plunger: false,
      auto_plunger: false,
      park_position: 0.167,
      scatter_velocity: 0.0,
      momentum_xfer: 1.0,
      is_timer_enabled: false,
      timer_interval: 100,
      is_visible: true,
      is_reflection_enabled: true,
      surface: '',
      tip_shape: '0 .34; 2 .6; 3 .64; 5 .7; 7 .84; 8 .88; 9 .9; 11 .92; 14 .92; 39 .84',
      rod_diam: 0.6,
      ring_gap: 2.0,
      ring_diam: 0.94,
      ring_width: 3.0,
      spring_diam: 0.77,
      spring_gauge: 1.38,
      spring_loops: 8.0,
      spring_end_loops: 2.5,
      is_locked: false,
    },
  },

  Flasher: {
    hasDragPoints: true,
    dragPointColor: '#ff0000',
    defaults: {
      height: 50.0,
      pos_x: 0.0,
      pos_y: 0.0,
      rot_x: 0.0,
      rot_y: 0.0,
      rot_z: 0.0,
      color: '#32c832',
      is_timer_enabled: false,
      timer_interval: 100,
      image_a: '',
      image_b: '',
      filter: 'overlay',
      filter_amount: 100,
      alpha: 100,
      add_blend: false,
      is_dmd: false,
      display_texture: false,
      depth_bias: 0.0,
      image_alignment: 'wrap',
      modulate_vs_add: 0.9,
      is_visible: true,
      drag_points: [
        { x: -50, y: -50, z: 0, smooth: false, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: -50, y: 50, z: 0, smooth: false, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: 50, y: 50, z: 0, smooth: false, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
        { x: 50, y: -50, z: 0, smooth: false, is_slingshot: false, has_auto_texture: true, tex_coord: 0 },
      ],
      is_locked: false,
    },
  },

  Timer: {
    defaults: {
      center: { x: 0, y: 0 },
      is_timer_enabled: false,
      timer_interval: 100,
      backglass: false,
      is_locked: false,
    },
  },

  Decal: {
    defaults: {
      center: { x: 0, y: 0 },
      width: 100.0,
      height: 100.0,
      rotation: 0.0,
      image: '',
      surface: '',
      decal_type: 'image',
      text: '',
      sizing_type: 'manual_size',
      material: '',
      font: {
        name: 'Arial Black',
        size: 142500,
        weight: 400,
        style: [],
      },
      color: '#000000',
      vertical_text: false,
      backglass: false,
      is_locked: false,
    },
  },

  TextBox: {
    defaults: {
      ver1: { x: 0, y: 0 },
      ver2: { x: 100, y: 50 },
      back_color: '#000000',
      font_color: '#ffffff',
      intensity_scale: 1.0,
      text: '',
      is_timer_enabled: false,
      timer_interval: 100,
      is_dmd: false,
      font: {
        name: 'Arial Black',
        size: 142500,
        weight: 400,
        style: [],
      },
      align: 'left',
      is_transparent: false,
      is_locked: false,
    },
  },

  Primitive: {
    defaults: {
      position: { x: 0, y: 0, z: 0 },
      size: { x: 100, y: 100, z: 100 },
      rot_and_tra: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      image: '',
      normal_map: '',
      sides: 4,
      material: '',
      side_color: '#969696',
      is_visible: true,
      draw_textures_inside: false,
      hit_event: false,
      threshold: 2.0,
      elasticity: 0.3,
      elasticity_falloff: 0.5,
      friction: 0.3,
      scatter: 0.0,
      edge_factor_ui: 0.25,
      collision_reduction_factor: 0.0,
      is_collidable: true,
      is_toy: false,
      use_3d_mesh: false,
      static_rendering: true,
      disable_lighting_top_old: 0.0,
      disable_lighting_below: 1.0,
      is_reflection_enabled: true,
      backfaces_enabled: false,
      physics_material: '',
      overwrite_physics: true,
      display_texture: false,
      object_space_normal_map: false,
      mesh_file_name: '',
      depth_bias: 0.0,
      add_blend: false,
      use_depth_mask: true,
      alpha: 100.0,
      color: '#ffffff',
      is_locked: false,
    },
  },

  Ball: {
    defaults: {
      pos: { x: 0, y: 0, z: 25 },
      radius: 25.0,
      mass: 1.0,
      is_visible: true,
      is_reflection_enabled: true,
      force_reflection: false,
      color: '#ffffff',
      image: '',
      image_decal: '',
      spherical_mapping: true,
      decal_mode: false,
      playfield_reflection_strength: 1.0,
      bulb_intensity_scale: 1.0,
      is_timer_enabled: false,
      timer_interval: 100,
      is_locked: false,
    },
  },

  Reel: {
    defaults: {
      ver1: { x: 0, y: 0 },
      ver2: { x: 200, y: 80 },
      back_color: '#404040',
      is_timer_enabled: false,
      timer_interval: 100,
      is_transparent: false,
      image: '',
      sound: '',
      width: 30.0,
      height: 40.0,
      reel_count: 5,
      reel_spacing: 4.0,
      motor_steps: 2,
      digit_range: 9,
      update_interval: 50,
      use_image_grid: false,
      is_visible: true,
      images_per_grid_row: 1,
      is_locked: false,
    },
  },

  LightSequencer: {
    defaults: {
      center: { x: 0, y: 0 },
      pos_x: 500.0,
      pos_y: 1000.0,
      collection: '',
      update_interval: 25,
      is_timer_enabled: false,
      timer_interval: 100,
      backglass: false,
      is_locked: false,
    },
  },
};

export function getObjectDefaults(type: string): ObjectDefaults | null {
  const typeDef = objectTypes[type];
  if (!typeDef) return null;
  return JSON.parse(JSON.stringify(typeDef.defaults));
}

export function hasObjectDragPoints(type: string): boolean {
  const typeDef = objectTypes[type];
  return typeDef?.hasDragPoints === true;
}
