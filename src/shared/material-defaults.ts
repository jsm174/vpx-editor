export const MATERIAL_TYPES = ['basic', 'metal', 'unknown'] as const;

export function getDefaultMaterial(): Record<string, unknown> {
  return {
    name: 'NewMaterial',
    type: 'basic',
    wrap_lighting: 0.25,
    roughness: 0.5,
    glossy_image_lerp: 0.5,
    thickness: 0.05,
    edge: 0.0,
    edge_alpha: 1.0,
    opacity: 0.0,
    base_color: '#808080',
    glossy_color: '#000000',
    clearcoat_color: '#000000',
    opacity_active: false,
    elasticity: 0.0,
    elasticity_falloff: 0.0,
    friction: 0.0,
    scatter_angle: 0.0,
    refraction_tint: '#ffffff',
  };
}

export const MATERIAL_KEYS = Object.keys(getDefaultMaterial());

export function validateMaterialFields(input: Record<string, unknown>): string | null {
  const unknown = Object.keys(input).filter(k => !MATERIAL_KEYS.includes(k));
  if (unknown.length > 0) {
    return `Unknown material field(s): ${unknown.join(', ')}. Valid keys: ${MATERIAL_KEYS.join(', ')}`;
  }
  if (input.type !== undefined && !MATERIAL_TYPES.includes(input.type as (typeof MATERIAL_TYPES)[number])) {
    return `Invalid material type "${String(input.type)}". Must be one of: ${MATERIAL_TYPES.join(', ')}`;
  }
  return null;
}
