import { z } from 'zod';

const xyz = z.object({ x: z.number(), y: z.number(), z: z.number() });
const position2 = z.object({ x: z.number(), y: z.number(), z: z.number().optional() });
const dragPoint = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
    smooth: z.boolean().optional(),
    is_slingshot: z.boolean().optional(),
  })
  .passthrough();

const commonName = { name: z.string().optional().describe('Auto-generated if omitted (e.g. "Bumper001").') };
const timerFields = {
  is_timer_enabled: z
    .boolean()
    .optional()
    .describe("Must be true for the part's {Name}_Timer Sub to fire. Defaults to false."),
  timer_interval: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Timer fire rate in milliseconds. Default 100. This is the on-disk field vpin reads (the COM property is TimerInterval).'
    ),
};
const morePass = {
  more: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Extra snake_case JSON fields to override. Call vpx_part(action:"template", type) to see the full schema.'
    ),
};

const lightBranch = z.object({
  type: z.literal('Light'),
  position: position2,
  ...commonName,
  intensity: z.number().optional(),
  falloff_radius: z.number().optional(),
  falloff_power: z.number().optional(),
  color: z.string().optional().describe('Hex like "#ffa957"'),
  color2: z.string().optional(),
  image: z.string().optional(),
  is_bulb_light: z.boolean().optional(),
  is_backglass: z.boolean().optional(),
  mesh_radius: z.number().optional(),
  surface: z.string().optional(),
  blink_pattern: z.string().optional().describe('e.g. "10" to blink; "1" = steady on'),
  blink_interval: z.number().int().optional(),
  transmission_scale: z.number().optional(),
  fade_speed_up: z.number().optional(),
  fade_speed_down: z.number().optional(),
  show_bulb_mesh: z.boolean().optional(),
  ...timerFields,
  ...morePass,
});

const flipperBranch = z.object({
  type: z.literal('Flipper'),
  position: position2,
  ...commonName,
  base_radius: z.number().optional(),
  end_radius: z.number().optional(),
  flipper_radius_max: z.number().optional(),
  start_angle: z.number().optional(),
  end_angle: z.number().optional(),
  strength: z.number().optional(),
  mass: z.number().optional(),
  return: z.number().optional().describe('Return strength ratio (vpin JSON key is literally "return")'),
  elasticity: z.number().optional(),
  elasticity_falloff: z.number().optional(),
  friction: z.number().optional(),
  ramp_up: z.number().optional(),
  height: z.number().optional(),
  surface: z.string().optional(),
  is_visible: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
  material: z.string().optional(),
  rubber_material: z.string().optional(),
  image: z.string().optional(),
  ...timerFields,
  ...morePass,
});

const bumperBranch = z.object({
  type: z.literal('Bumper'),
  position: position2,
  ...commonName,
  radius: z.number().optional(),
  force: z.number().optional(),
  threshold: z.number().optional(),
  scatter: z.number().optional(),
  height_scale: z.number().optional(),
  orientation: z.number().optional(),
  ring_material: z.string().optional(),
  cap_material: z.string().optional(),
  socket_material: z.string().optional(),
  base_material: z.string().optional(),
  surface: z.string().optional(),
  hit_event: z.boolean().optional(),
  is_collidable: z.boolean().optional(),
  is_cap_visible: z.boolean().optional(),
  is_base_visible: z.boolean().optional(),
  is_ring_visible: z.boolean().optional(),
  is_socket_visible: z.boolean().optional(),
  ...timerFields,
  ...morePass,
});

const kickerBranch = z.object({
  type: z.literal('Kicker'),
  position: position2,
  ...commonName,
  radius: z.number().optional(),
  kicker_type: z
    .enum(['invisible', 'hole', 'cup', 'hole_simple', 'williams', 'gottlieb', 'cup2'])
    .optional()
    .describe('Kicker visual style; "hole" is the common default.'),
  orientation: z.number().optional(),
  hit_height: z.number().optional(),
  hit_accuracy: z.number().optional(),
  scatter: z.number().optional(),
  fall_through: z.boolean().optional(),
  legacy_mode: z.boolean().optional(),
  surface: z.string().optional(),
  is_enabled: z.boolean().optional(),
  material: z.string().optional(),
  ...timerFields,
  ...morePass,
});

const wallBranch = z.object({
  type: z.literal('Wall'),
  position: position2,
  drag_points: z
    .array(dragPoint)
    .optional()
    .describe(
      'Polyline points in ABSOLUTE world coordinates (NOT relative to position). For a footprint around (cx, cy) with half-width r, pass [{x:cx-r,y:cy-r},{x:cx-r,y:cy+r},{x:cx+r,y:cy+r},{x:cx+r,y:cy-r}]. If omitted, a small square around `position` is created.'
    ),
  ...commonName,
  height_bottom: z.number().optional(),
  height_top: z.number().optional(),
  top_material: z.string().optional(),
  side_material: z.string().optional(),
  image: z.string().optional(),
  is_top_bottom_visible: z.boolean().optional(),
  is_side_visible: z.boolean().optional(),
  is_collidable: z.boolean().optional(),
  ...timerFields,
  ...morePass,
});

const rubberBranch = z.object({
  type: z.literal('Rubber'),
  position: position2,
  drag_points: z
    .array(dragPoint)
    .optional()
    .describe(
      'Polyline points in ABSOLUTE world coordinates (NOT relative to position). For a footprint around (cx, cy) with half-width r, pass [{x:cx-r,y:cy-r},{x:cx-r,y:cy+r},{x:cx+r,y:cy+r},{x:cx+r,y:cy-r}]. If omitted, a small square around `position` is created.'
    ),
  ...commonName,
  height: z.number().optional(),
  thickness: z.number().int().optional(),
  material: z.string().optional(),
  image: z.string().optional(),
  rot_x: z.number().optional(),
  rot_y: z.number().optional(),
  rot_z: z.number().optional(),
  ...timerFields,
  ...morePass,
});

const rampBranch = z.object({
  type: z.literal('Ramp'),
  position: position2,
  drag_points: z
    .array(dragPoint)
    .optional()
    .describe(
      'Polyline points in ABSOLUTE world coordinates (NOT relative to position). For a footprint around (cx, cy) with half-width r, pass [{x:cx-r,y:cy-r},{x:cx-r,y:cy+r},{x:cx+r,y:cy+r},{x:cx+r,y:cy-r}]. If omitted, a small square around `position` is created.'
    ),
  ...commonName,
  ramp_type: z.enum(['flat', 'four_wire', 'two_wire', 'three_wire_left', 'three_wire_right', 'one_wire']).optional(),
  height_bottom: z.number().optional(),
  height_top: z.number().optional(),
  width_bottom: z.number().optional(),
  width_top: z.number().optional(),
  left_wall_height: z.number().optional(),
  right_wall_height: z.number().optional(),
  material: z.string().optional(),
  image: z.string().optional(),
  ...timerFields,
  ...morePass,
});

const gateBranch = z.object({
  type: z.literal('Gate'),
  position: position2,
  ...commonName,
  gate_type: z.enum(['wire_w', 'wire_rectangle', 'plate', 'long_plate']).optional(),
  length: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().optional(),
  angle_max: z.number().optional().describe('Open angle in degrees'),
  angle_min: z.number().optional().describe('Closed angle in degrees'),
  material: z.string().optional(),
  ...timerFields,
  ...morePass,
});

const spinnerBranch = z.object({
  type: z.literal('Spinner'),
  position: position2,
  ...commonName,
  length: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().optional(),
  damping: z.number().optional(),
  material: z.string().optional(),
  ...timerFields,
  ...morePass,
});

const hitTargetBranch = z.object({
  type: z.literal('HitTarget'),
  position: position2,
  ...commonName,
  target_type: z
    .enum([
      'drop_target_beveled',
      'drop_target_simple',
      'hit_target_round',
      'hit_target_rectangle',
      'hit_fat_target_rectangle',
      'hit_fat_target_square',
      'drop_target_flat_simple',
      'hit_fat_target_slim',
      'hit_target_slim',
    ])
    .optional(),
  size: xyz.optional(),
  rot_z: z.number().optional(),
  drop_speed: z.number().optional(),
  raise_delay: z.number().int().optional(),
  material: z.string().optional(),
  image: z.string().optional(),
  ...timerFields,
  ...morePass,
});

const triggerBranch = z.object({
  type: z.literal('Trigger'),
  position: position2,
  drag_points: z
    .array(dragPoint)
    .optional()
    .describe(
      'Polyline points in ABSOLUTE world coordinates (NOT relative to position). For a footprint around (cx, cy) with half-width r, pass [{x:cx-r,y:cy-r},{x:cx-r,y:cy+r},{x:cx+r,y:cy+r},{x:cx+r,y:cy-r}]. If omitted, a small square around `position` is created.'
    ),
  ...commonName,
  shape: z.enum(['none', 'wire_a', 'star', 'wire_b', 'button', 'wire_c', 'wire_d', 'inder']).optional(),
  radius: z.number().optional(),
  rotation: z.number().optional(),
  hit_height: z.number().optional(),
  wire_thickness: z.number().optional(),
  scale_x: z.number().optional(),
  scale_y: z.number().optional(),
  anim_speed: z.number().optional(),
  surface: z.string().optional(),
  material: z.string().optional(),
  is_visible: z.boolean().optional(),
  is_enabled: z
    .boolean()
    .optional()
    .describe(
      'Whether the trigger fires collision events. Different from is_timer_enabled (which controls Trigger_Timer firing).'
    ),
  ...timerFields,
  ...morePass,
});

const plungerBranch = z.object({
  type: z.literal('Plunger'),
  position: position2,
  ...commonName,
  plunger_type: z.enum(['modern', 'flat', 'custom']).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  stroke: z.number().optional(),
  speed_pull: z.number().optional(),
  speed_fire: z.number().optional(),
  mech_strength: z.number().optional(),
  z_adjust: z.number().optional(),
  is_mech_plunger: z.boolean().optional().describe('True = analog/mechanical plunger input'),
  auto_plunger: z.boolean().optional().describe('True = coil-fired autolaunch behavior'),
  park_position: z.number().optional(),
  scatter_velocity: z.number().optional(),
  momentum_xfer: z.number().optional(),
  surface: z.string().optional(),
  is_visible: z.boolean().optional(),
  material: z.string().optional(),
  image: z.string().optional(),
  ...timerFields,
  ...morePass,
});

const flasherBranch = z.object({
  type: z.literal('Flasher'),
  position: position2,
  ...commonName,
  height: z.number().optional(),
  size: z.number().optional(),
  alpha: z.number().int().optional(),
  color: z.string().optional(),
  rot_x: z.number().optional(),
  rot_y: z.number().optional(),
  rot_z: z.number().optional(),
  image_a: z.string().optional(),
  image_b: z.string().optional(),
  filter_amount: z.number().int().optional(),
  ...timerFields,
  ...morePass,
});

const decalBranch = z.object({
  type: z.literal('Decal'),
  position: position2,
  ...commonName,
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().optional(),
  text: z.string().optional(),
  image: z.string().optional(),
  material: z.string().optional(),
  ...timerFields,
  ...morePass,
});

const textBoxBranch = z.object({
  type: z.literal('TextBox'),
  position: position2,
  ...commonName,
  text: z.string().optional(),
  font_color: z.string().optional(),
  back_color: z.string().optional(),
  intensity_scale: z.number().optional(),
  ...timerFields,
  ...morePass,
});

const reelBranch = z.object({
  type: z.literal('Reel'),
  position: position2,
  ...commonName,
  width: z.number().optional(),
  height: z.number().optional(),
  reel_count: z.number().int().optional(),
  reel_spacing: z.number().optional(),
  digit_range: z.number().int().optional(),
  image: z.string().optional(),
  back_color: z.string().optional(),
  ...timerFields,
  ...morePass,
});

const lightSequencerBranch = z.object({
  type: z.literal('LightSequencer'),
  position: position2,
  ...commonName,
  collection: z.string().optional(),
  update_interval: z.number().int().optional(),
  ...timerFields,
  ...morePass,
});

const timerBranch = z.object({
  type: z.literal('Timer'),
  position: position2,
  ...commonName,
  ...timerFields,
  ...morePass,
});

const primitiveBranch = z.object({
  type: z.literal('Primitive'),
  position: position2,
  ...commonName,
  size: xyz.optional(),
  sides: z.number().int().min(3).optional(),
  image: z.string().optional(),
  normal_map: z.string().optional(),
  material: z.string().optional(),
  physics_material: z.string().optional(),
  mesh_file_name: z.string().optional(),
  rot_and_tra: z
    .array(z.number())
    .length(9)
    .optional()
    .describe('[rotX, rotY, rotZ, transX, transY, transZ, objRotX, objRotY, objRotZ]'),
  side_color: z.string().optional(),
  color: z.string().optional(),
  is_visible: z.boolean().optional(),
  is_collidable: z.boolean().optional(),
  is_toy: z.boolean().optional(),
  use_3d_mesh: z.boolean().optional(),
  static_rendering: z.boolean().optional(),
  alpha: z.number().optional(),
  hit_event: z.boolean().optional(),
  threshold: z.number().optional(),
  elasticity: z.number().optional(),
  elasticity_falloff: z.number().optional(),
  friction: z.number().optional(),
  scatter: z.number().optional(),
  depth_bias: z.number().optional(),
  add_blend: z.boolean().optional(),
  disable_lighting_top: z.number().optional(),
  disable_lighting_below: z.number().optional(),
  ...timerFields,
  ...morePass,
});

const ballBranch = z.object({
  type: z.literal('Ball'),
  position: position2,
  ...commonName,
  radius: z.number().optional(),
  mass: z.number().optional(),
  color: z.string().optional(),
  image: z.string().optional(),
  image_decal: z.string().optional(),
  ...timerFields,
  ...morePass,
});

export const addPartSchema = z.discriminatedUnion('type', [
  lightBranch,
  flipperBranch,
  bumperBranch,
  kickerBranch,
  wallBranch,
  rubberBranch,
  rampBranch,
  gateBranch,
  spinnerBranch,
  hitTargetBranch,
  triggerBranch,
  plungerBranch,
  flasherBranch,
  decalBranch,
  textBoxBranch,
  reelBranch,
  lightSequencerBranch,
  timerBranch,
  primitiveBranch,
  ballBranch,
]);

const namePatch = z.object({ partName: z.string().describe('Name of the part to modify') });

export const modifyPartSchema = z.discriminatedUnion('type', [
  lightBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  flipperBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  bumperBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  kickerBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  wallBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  rubberBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  rampBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  gateBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  spinnerBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  hitTargetBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  triggerBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  plungerBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  flasherBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  decalBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  textBoxBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  reelBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  lightSequencerBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  timerBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  primitiveBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
  ballBranch.extend(namePatch.shape).partial().required({ type: true, partName: true }),
]);

export type AddPartInput = z.infer<typeof addPartSchema>;
export type ModifyPartInput = z.infer<typeof modifyPartSchema>;

export const PART_TYPES = [
  'Light',
  'Flipper',
  'Bumper',
  'Kicker',
  'Wall',
  'Rubber',
  'Ramp',
  'Gate',
  'Spinner',
  'HitTarget',
  'Trigger',
  'Plunger',
  'Flasher',
  'Decal',
  'TextBox',
  'Reel',
  'LightSequencer',
  'Timer',
  'Primitive',
  'Ball',
] as const;

export function extractAddPartFields(input: AddPartInput): {
  type: string;
  position: { x: number; y: number; z?: number };
  name?: string;
  overrides: Record<string, unknown>;
} {
  const { type, position, name, more, ...rest } = input as Record<string, unknown> & {
    type: string;
    position: { x: number; y: number; z?: number };
    name?: string;
    more?: Record<string, unknown>;
  };
  const overrides: Record<string, unknown> = { ...rest, ...(more ?? {}) };
  return { type, position, name, overrides };
}

export function extractModifyPartFields(input: ModifyPartInput): {
  type: string;
  partName: string;
  overrides: Record<string, unknown>;
} {
  const { type, partName, name, more, ...rest } = input as Record<string, unknown> & {
    type: string;
    partName: string;
    name?: string;
    more?: Record<string, unknown>;
  };
  void name;
  const overrides: Record<string, unknown> = { ...rest, ...(more ?? {}) };
  return { type, partName, overrides };
}
