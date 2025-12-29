export const BALL_DEFAULTS = {
  radius: 25.0,
  mass: 1.0,
  bulb_intensity_scale: 1.0,
  playfield_reflection_strength: 1.0,
  timer_interval: 100,
};

export const BUMPER_DEFAULTS = {
  radius: 45.0,
  heightScale: 90.0,
  orientation: 0.0,
  ringDropOffset: 0.0,
  ringSpeed: 0.5,
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
  modulateVsAdd: 0.9,
  filterAmount: 100,
  depthBias: 0.0,
  renderStyle: 0,
  timer_interval: 100,
};

export const FLIPPER_DEFAULTS = {
  baseRadius: 21.5,
  endRadius: 13.0,
  flipperRadiusMax: 130.0,
  flipperRadiusMin: 0.0,
  height: 50.0,
  startAngle: 121.0,
  endAngle: 70.0,
  rubberThickness: 7.0,
  rubberHeight: 19.0,
  rubberWidth: 24.0,
  strength: 2200.0,
  elasticity: 0.8,
  elasticityFalloff: 0.43,
  friction: 0.6,
  rampUp: 3.0,
  return: 0.058,
  scatter: 0.0,
  mass: 1.0,
  torqueDamping: 0.75,
  torqueDampingAngle: 6.0,
  timer_interval: 100,
};

export const GATE_DEFAULTS = {
  length: 100.0,
  height: 50.0,
  rotation: -90.0,
  elasticity: 0.3,
  friction: 0.02,
  damping: 0.985,
  gravityFactor: 0.25,
  timer_interval: 100,
};

export const HITTARGET_DEFAULTS = {
  sizeX: 32.0,
  sizeY: 32.0,
  sizeZ: 32.0,
  rotZ: 0.0,
  dropSpeed: 0.2,
  raiseDelay: 100,
  elasticity: 0.35,
  elasticityFalloff: 0.5,
  friction: 0.2,
  scatter: 5.0,
  threshold: 2.0,
  depthBias: 0.0,
  disableLightingTop: 0.0,
  disableLightingBelow: 1.0,
  timer_interval: 100,
};

export const KICKER_DEFAULTS = {
  radius: 25.0,
  orientation: 0.0,
  hitHeight: 35.0,
  hitAccuracy: 0.5,
  scatter: 0.0,
  timer_interval: 100,
};

export const LIGHT_DEFAULTS = {
  falloff: 50.0,
  falloffPower: 2.0,
  intensity: 10.0,
  state: 0.0,
  color: '#ffa957',
  meshRadius: 20.0,
  bulbHaloHeight: 28.0,
  bulbModulateVsAdd: 0.9,
  transmissionScale: 0.0,
  fadeSpeedUp: 0.05,
  fadeSpeedDown: 0.02,
  blinkPattern: '10',
  blinkInterval: 125,
  depthBias: 0.0,
  timer_interval: 100,
};

export const LIGHTSEQUENCER_DEFAULTS = {
  posX: 500.0,
  posY: 1000.0,
  updateInterval: 25,
  timer_interval: 100,
};

export const PARTGROUP_DEFAULTS = {
  playerModeVisibilityMask: 0xffff,
  timer_interval: 100,
};

export const PLUNGER_DEFAULTS = {
  width: 25.0,
  height: 20.0,
  zAdjust: 0.0,
  stroke: 80.0,
  speedPull: 5.0,
  speedFire: 80.0,
  mechStrength: 85.0,
  momentumXfer: 1.0,
  scatterVelocity: 0.0,
  parkPosition: 0.167,
  rodDiam: 0.6,
  ringGap: 2.0,
  ringDiam: 0.94,
  ringWidth: 3.0,
  springDiam: 0.77,
  springGauge: 1.38,
  springLoops: 8.0,
  springEndLoops: 2.5,
  animFrames: 1,
  timer_interval: 100,
};

export const PRIMITIVE_DEFAULTS = {
  sizeX: 100.0,
  sizeY: 100.0,
  sizeZ: 100.0,
  sides: 4,
  alpha: 100,
  elasticity: 0.3,
  elasticityFalloff: 0.5,
  friction: 0.3,
  scatter: 0.0,
  threshold: 2.0,
  collisionReductionFactor: 0.0,
  depthBias: 0.0,
  disableLightingTop: 0.0,
  disableLightingBelow: 0.0,
  reflectionStrength: 1.0,
  refractionThickness: 10.0,
  edgeFactorUI: 0.25,
};

export const RAMP_DEFAULTS = {
  heightBottom: 0.0,
  heightTop: 50.0,
  widthBottom: 75.0,
  widthTop: 60.0,
  leftWallHeight: 62.0,
  leftWallHeightVisible: 30.0,
  rightWallHeight: 62.0,
  rightWallHeightVisible: 30.0,
  wireDiameter: 8.0,
  wireDistanceX: 38.0,
  wireDistanceY: 88.0,
  elasticity: 0.3,
  elasticityFalloff: 0.0,
  friction: 0.3,
  scatter: 0.0,
  threshold: 2.0,
  depthBias: 0.0,
  timer_interval: 100,
};

export const REEL_DEFAULTS = {
  width: 30.0,
  height: 40.0,
  reelSpacing: 4.0,
  reelCount: 5,
  digitRange: 9,
  motorSteps: 2,
  updateInterval: 50,
  imagesPerGridRow: 1,
  backColor: '#000000',
  timer_interval: 100,
};

export const RUBBER_DEFAULTS = {
  height: 25.0,
  hitHeight: 25.0,
  thickness: 8,
  rotX: 0.0,
  rotY: 0.0,
  rotZ: 0.0,
  elasticity: 0.8,
  elasticityFalloff: 0.3,
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
  angleMax: 0.0,
  angleMin: 0.3,
  timer_interval: 100,
};

export const TEXTBOX_DEFAULTS = {
  backColor: '#000000',
  fontColor: '#ffffff',
  intensityScale: 1.0,
  timer_interval: 100,
};

export const TIMER_DEFAULTS = {
  interval: 100,
};

export const TRIGGER_DEFAULTS = {
  radius: 25.0,
  rotation: 0.0,
  scaleX: 1.0,
  scaleY: 1.0,
  hitHeight: 50.0,
  animSpeed: 1.0,
  wireThickness: 0.0,
  timer_interval: 100,
};

export const WALL_DEFAULTS = {
  heightBottom: 0.0,
  heightTop: 50.0,
  slingshotForce: 80.0,
  slingshotThreshold: 0.0,
  elasticity: 0.3,
  elasticityFalloff: 0.0,
  friction: 0.3,
  scatter: 0.0,
  threshold: 2.0,
  disableLightingTop: 0.0,
  disableLightingBelow: 1.0,
  timer_interval: 100,
};
