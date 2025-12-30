export const BALL_DEFAULTS = {
  radius: 25.0,
  mass: 1.0,
  bulb_intensity_scale: 1.0,
  playfield_reflection_strength: 1.0,
  timer_interval: 100,
};

export const BUMPER_DEFAULTS = {
  radius: 45.0,
  height_scale: 90.0,
  orientation: 0.0,
  ring_drop_offset: 0.0,
  ring_speed: 0.5,
  force: 15.0,
  threshold: 1.0,
  scatter: 0.0,
  timer_interval: 100,
};

export const DECAL_DEFAULTS = {
  width: 100.0,
  height: 100.0,
  rotation: 0.0,
};

export const FLASHER_DEFAULTS = {
  height: 50.0,
  size: 100.0,
  alpha: 100,
  color: 0xffff00,
  modulate_vs_add: 0.9,
  filter_amount: 100,
  depth_bias: 0.0,
  render_style: 0,
  timer_interval: 100,
};

export const FLIPPER_DEFAULTS = {
  base_radius: 21.5,
  end_radius: 13.0,
  flipper_radius_max: 130.0,
  flipper_radius_min: 0.0,
  height: 50.0,
  start_angle: 121.0,
  end_angle: 70.0,
  rubber_thickness: 7.0,
  rubber_height: 19.0,
  rubber_width: 24.0,
  strength: 2200.0,
  elasticity: 0.8,
  elasticity_falloff: 0.43,
  friction: 0.6,
  ramp_up: 3.0,
  return: 0.058,
  scatter: 0.0,
  mass: 1.0,
  torque_damping: 0.75,
  torque_damping_angle: 6.0,
  timer_interval: 100,
};

export const GATE_DEFAULTS = {
  length: 100.0,
  height: 50.0,
  rotation: -90.0,
  elasticity: 0.3,
  friction: 0.02,
  damping: 0.985,
  gravity_factor: 0.25,
  timer_interval: 100,
};

export const HITTARGET_DEFAULTS = {
  size_x: 32.0,
  size_y: 32.0,
  size_z: 32.0,
  rot_z: 0.0,
  drop_speed: 0.2,
  raise_delay: 100,
  elasticity: 0.35,
  elasticity_falloff: 0.5,
  friction: 0.2,
  scatter: 5.0,
  threshold: 2.0,
  depth_bias: 0.0,
  disable_lighting_top: 0.0,
  disable_lighting_below: 1.0,
  timer_interval: 100,
};

export const KICKER_DEFAULTS = {
  radius: 25.0,
  orientation: 0.0,
  hit_height: 35.0,
  hit_accuracy: 0.5,
  scatter: 0.0,
  timer_interval: 100,
};

export const LIGHT_DEFAULTS = {
  falloff: 50.0,
  falloff_power: 2.0,
  intensity: 10.0,
  state: 0.0,
  color: '#ffa957',
  mesh_radius: 20.0,
  bulb_halo_height: 28.0,
  bulb_modulate_vs_add: 0.9,
  transmission_scale: 0.0,
  fade_speed_up: 0.05,
  fade_speed_down: 0.02,
  blink_pattern: '10',
  blink_interval: 125,
  depth_bias: 0.0,
  timer_interval: 100,
};

export const LIGHTSEQUENCER_DEFAULTS = {
  pos_x: 500.0,
  pos_y: 1000.0,
  update_interval: 25,
  timer_interval: 100,
};

export const PARTGROUP_DEFAULTS = {
  player_mode_visibility_mask: 0xffff,
  timer_interval: 100,
};

export const PLUNGER_DEFAULTS = {
  width: 25.0,
  height: 20.0,
  z_adjust: 0.0,
  stroke: 80.0,
  speed_pull: 5.0,
  speed_fire: 80.0,
  mech_strength: 85.0,
  momentum_xfer: 1.0,
  scatter_velocity: 0.0,
  park_position: 0.167,
  rod_diam: 0.6,
  ring_gap: 2.0,
  ring_diam: 0.94,
  ring_width: 3.0,
  spring_diam: 0.77,
  spring_gauge: 1.38,
  spring_loops: 8.0,
  spring_end_loops: 2.5,
  anim_frames: 1,
  timer_interval: 100,
};

export const PRIMITIVE_DEFAULTS = {
  size_x: 100.0,
  size_y: 100.0,
  size_z: 100.0,
  sides: 4,
  alpha: 100,
  elasticity: 0.3,
  elasticity_falloff: 0.5,
  friction: 0.3,
  scatter: 0.0,
  threshold: 2.0,
  collision_reduction_factor: 0.0,
  depth_bias: 0.0,
  disable_lighting_top: 0.0,
  disable_lighting_below: 0.0,
  reflection_strength: 1.0,
  refraction_thickness: 10.0,
  edge_factor_ui: 0.25,
};

export const RAMP_DEFAULTS = {
  height_bottom: 0.0,
  height_top: 50.0,
  width_bottom: 75.0,
  width_top: 60.0,
  left_wall_height: 62.0,
  left_wall_height_visible: 30.0,
  right_wall_height: 62.0,
  right_wall_height_visible: 30.0,
  wire_diameter: 8.0,
  wire_distance_x: 38.0,
  wire_distance_y: 88.0,
  elasticity: 0.3,
  elasticity_falloff: 0.0,
  friction: 0.3,
  scatter: 0.0,
  threshold: 2.0,
  depth_bias: 0.0,
  timer_interval: 100,
};

export const REEL_DEFAULTS = {
  width: 30.0,
  height: 40.0,
  reel_spacing: 4.0,
  reel_count: 5,
  digit_range: 9,
  motor_steps: 2,
  update_interval: 50,
  images_per_grid_row: 1,
  back_color: '#000000',
  timer_interval: 100,
};

export const RUBBER_DEFAULTS = {
  height: 25.0,
  hit_height: 25.0,
  thickness: 8,
  rot_x: 0.0,
  rot_y: 0.0,
  rot_z: 0.0,
  elasticity: 0.8,
  elasticity_falloff: 0.3,
  friction: 0.6,
  scatter: 5.0,
  timer_interval: 100,
};

export const SPINNER_DEFAULTS = {
  length: 80.0,
  height: 60.0,
  rotation: 0.0,
  damping: 0.9879,
  elasticity: 0.3,
  angle_max: 0.0,
  angle_min: 0.3,
  timer_interval: 100,
};

export const TEXTBOX_DEFAULTS = {
  back_color: '#000000',
  font_color: '#ffffff',
  intensity_scale: 1.0,
  timer_interval: 100,
};

export const TIMER_DEFAULTS = {
  interval: 100,
};

export const TRIGGER_DEFAULTS = {
  radius: 25.0,
  rotation: 0.0,
  scale_x: 1.0,
  scale_y: 1.0,
  hit_height: 50.0,
  anim_speed: 1.0,
  wire_thickness: 0.0,
  timer_interval: 100,
};

export const WALL_DEFAULTS = {
  height_bottom: 0.0,
  height_top: 50.0,
  slingshot_force: 80.0,
  slingshot_threshold: 0.0,
  elasticity: 0.3,
  elasticity_falloff: 0.0,
  friction: 0.3,
  scatter: 0.0,
  threshold: 2.0,
  disable_lighting_top: 0.0,
  disable_lighting_below: 1.0,
  timer_interval: 100,
};
