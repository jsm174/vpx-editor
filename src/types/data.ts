import type { Point } from './game-objects.js';

export interface GameData {
  screen_shot?: string;
  locked: number;
  left?: number;
  top?: number;
  right: number;
  bottom: number;
  glass_top_height: number;
  glass_bottom_height: number;
  image?: string;
  playfield_material?: string;
  ball_image?: string;
  ball_image_front_decal?: string;
  ball_decal_mode?: number;
  environment_image?: string;
  notes?: string;
  screen_shot_front?: string;
  custom_info_block?: Record<string, string>;
  default_bulb_intensity_scale_on_ball?: number;
  playfield_reflection_strength?: number;
  ball_playfield_reflection_strength?: number;
  ball_trail_strength?: number;
  use_trail_for_balls?: boolean;
  user_detail_level?: number;
  override_physics?: number;
  override_physics_flipper?: boolean;
  gravity?: number;
  friction?: number;
  elasticity?: number;
  elastic_falloff?: number;
  scatter?: number;
  default_scatter?: number;
  nudge_time?: number;
  plunger_normalize?: number;
  plunger_filter?: boolean;
  physics_max_loops?: number;
  render_em_reels?: boolean;
  render_decals?: boolean;
  offset?: Point;
  zoom?: number;
  angle_tilt_max?: number;
  angle_tilt_min?: number;
  stereo_max_separation?: number;
  stereo_zero_parallax_displacement?: number;
  stereo_offset?: number;
  overwrite_global_stereo3d?: boolean;
  bloom_strength?: number;
  ssao?: number;
  tone_mapper?: number;
  color_grade_image?: string;
  difficulty?: number;
  light_ambient?: number;
  light_height?: number;
  light_range?: number;
  light_emission_scale?: number;
  environment_emission_scale?: number;
  global_alpha_acc?: number;
  ao_scale?: number;
  ssr_scale?: number;
  table_music_volume?: number;
  table_sound_volume?: number;
  ball_reflection?: number;
  playfield_reflection?: number;
  global_difficulty?: number;
  [key: string]: unknown;
}

export interface TableInfo {
  table_name?: string | null;
  author_name?: string | null;
  table_blurb?: string | null;
  table_rules?: string | null;
  author_email?: string | null;
  release_date?: string | null;
  table_save_rev?: string | number | null;
  table_version?: string | null;
  author_website?: string | null;
  table_save_date?: string | null;
  table_description?: string | null;
  properties?: Record<string, string>;
  properties_order?: string[];
  [key: string]: unknown;
}

export interface Material {
  name: string;
  base_color?: number;
  glossy_color?: number;
  clearcoat_color?: number;
  wrap_lighting?: number;
  roughness?: number;
  glossy_image_lerp?: number;
  thickness?: number;
  edge?: number;
  edge_alpha?: number;
  opacity?: number;
  is_metal?: boolean;
  is_opaque_active?: boolean;
  elasticity?: number;
  elasticity_falloff?: number;
  friction?: number;
  scatter_angle?: number;
  refraction_tint?: number[];
}

export interface ImageInfo {
  name: string;
  internal_name?: string;
  path?: string;
  width?: number;
  height?: number;
  alpha_test_value?: number;
}

export interface Sound {
  name: string;
  internal_name?: string;
  path?: string;
  output_target?: number;
  volume?: number;
  balance?: number;
  fade?: number;
}

export interface RenderProbe {
  name: string;
  type?: number;
  roughness?: number;
  reflection_plane?: {
    normal?: Point & { z: number };
    distance?: number;
  };
  reflection_mode?: number;
}

export interface Collection {
  name: string;
  items?: string[];
  fire_events?: boolean;
  stop_single_events?: boolean;
  group_elements?: boolean;
}

export interface ClipboardItem {
  type: string;
  data: Record<string, unknown>;
  originalCenter: Point;
  meshData?: string | null;
}

export interface ClipboardData {
  items: ClipboardItem[];
}

export interface TableLoadedData {
  extractedDir: string;
  vpxPath: string;
  tableName: string;
  isTableLocked: boolean;
}
