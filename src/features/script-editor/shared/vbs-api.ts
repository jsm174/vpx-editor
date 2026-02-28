export interface VpxItemApi {
  properties: string[];
  readOnlyProperties?: string[];
  methods?: { name: string; signature: string }[];
}

export const VPX_ITEM_API: Record<string, VpxItemApi> = {
  Flipper: {
    properties: [
      'BaseRadius',
      'EndRadius',
      'Length',
      'StartAngle',
      'EndAngle',
      'TimerEnabled',
      'TimerInterval',
      'X',
      'Y',
      'Material',
      'Mass',
      'OverridePhysics',
      'RubberMaterial',
      'RubberThickness',
      'Strength',
      'Visible',
      'Enabled',
      'Elasticity',
      'Scatter',
      'Return',
      'RubberHeight',
      'RubberWidth',
      'Friction',
      'RampUp',
      'ElasticityFalloff',
      'Surface',
      'Name',
      'UserValue',
      'Height',
      'EOSTorque',
      'EOSTorqueAngle',
      'FlipperRadiusMin',
      'Image',
      'ReflectionEnabled',
    ],
    readOnlyProperties: ['CurrentAngle'],
    methods: [
      { name: 'RotateToEnd', signature: '()' },
      { name: 'RotateToStart', signature: '()' },
    ],
  },

  Timer: {
    properties: ['Enabled', 'Interval', 'Name', 'UserValue'],
  },

  Wall: {
    properties: [
      'Name',
      'TimerEnabled',
      'TimerInterval',
      'HasHitEvent',
      'Threshold',
      'Image',
      'SideMaterial',
      'ImageAlignment',
      'HeightBottom',
      'HeightTop',
      'TopMaterial',
      'CanDrop',
      'Collidable',
      'IsDropped',
      'DisplayTexture',
      'SlingshotStrength',
      'Elasticity',
      'ElasticityFalloff',
      'SideImage',
      'Visible',
      'Disabled',
      'SideVisible',
      'UserValue',
      'SlingshotMaterial',
      'SlingshotThreshold',
      'SlingshotAnimation',
      'FlipbookAnimation',
      'IsBottomSolid',
      'DisableLighting',
      'BlendDisableLighting',
      'BlendDisableLightingFromBelow',
      'Friction',
      'Scatter',
      'ReflectionEnabled',
      'PhysicsMaterial',
      'OverwritePhysics',
    ],
    methods: [{ name: 'PlaySlingshotHit', signature: '()' }],
  },

  Surface: {
    properties: [
      'Name',
      'TimerEnabled',
      'TimerInterval',
      'HasHitEvent',
      'Threshold',
      'Image',
      'SideMaterial',
      'ImageAlignment',
      'HeightBottom',
      'HeightTop',
      'TopMaterial',
      'CanDrop',
      'Collidable',
      'IsDropped',
      'DisplayTexture',
      'SlingshotStrength',
      'Elasticity',
      'ElasticityFalloff',
      'SideImage',
      'Visible',
      'Disabled',
      'SideVisible',
      'UserValue',
      'SlingshotMaterial',
      'SlingshotThreshold',
      'SlingshotAnimation',
      'FlipbookAnimation',
      'IsBottomSolid',
      'DisableLighting',
      'BlendDisableLighting',
      'BlendDisableLightingFromBelow',
      'Friction',
      'Scatter',
      'ReflectionEnabled',
      'PhysicsMaterial',
      'OverwritePhysics',
    ],
    methods: [{ name: 'PlaySlingshotHit', signature: '()' }],
  },

  Bumper: {
    properties: [
      'Radius',
      'X',
      'Y',
      'BaseMaterial',
      'SkirtMaterial',
      'UserValue',
      'Surface',
      'Force',
      'Threshold',
      'TimerEnabled',
      'TimerInterval',
      'CapMaterial',
      'RingMaterial',
      'HeightScale',
      'Orientation',
      'RingSpeed',
      'RingDropOffset',
      'Name',
      'HasHitEvent',
      'CapVisible',
      'BaseVisible',
      'RingVisible',
      'SkirtVisible',
      'Collidable',
      'ReflectionEnabled',
      'Scatter',
      'EnableSkirtAnimation',
    ],
    readOnlyProperties: ['CurrentRingOffset', 'RotX', 'RotY'],
    methods: [{ name: 'PlayHit', signature: '()' }],
  },

  Trigger: {
    properties: [
      'Radius',
      'TimerEnabled',
      'TimerInterval',
      'X',
      'Y',
      'Enabled',
      'Visible',
      'TriggerShape',
      'Surface',
      'Name',
      'UserValue',
      'HitHeight',
      'Material',
      'Rotation',
      'WireThickness',
      'AnimSpeed',
      'ReflectionEnabled',
    ],
    readOnlyProperties: ['CurrentAnimOffset'],
    methods: [
      { name: 'BallCntOver', signature: '(): number' },
      { name: 'DestroyBall', signature: '(): number' },
    ],
  },

  Light: {
    properties: [
      'Falloff',
      'FalloffPower',
      'State',
      'Color',
      'ColorFull',
      'TimerEnabled',
      'TimerInterval',
      'X',
      'Y',
      'BlinkPattern',
      'BlinkInterval',
      'Intensity',
      'TransmissionScale',
      'IntensityScale',
      'Surface',
      'Name',
      'UserValue',
      'Image',
      'ImageMode',
      'DepthBias',
      'FadeSpeedUp',
      'FadeSpeedDown',
      'Bulb',
      'ShowBulbMesh',
      'StaticBulbMesh',
      'ShowReflectionOnBall',
      'ScaleBulbMesh',
      'BulbModulateVsAdd',
      'BulbHaloHeight',
      'Visible',
      'Shadows',
      'Fader',
    ],
    readOnlyProperties: ['FilamentTemperature'],
    methods: [
      { name: 'GetInPlayState', signature: '(): number' },
      { name: 'GetInPlayStateBool', signature: '(): boolean' },
      { name: 'GetInPlayIntensity', signature: '(): number' },
      { name: 'Duration', signature: '(startState: number, duration: number, endState: number)' },
    ],
  },

  Kicker: {
    properties: [
      'Name',
      'TimerEnabled',
      'TimerInterval',
      'X',
      'Y',
      'Enabled',
      'DrawStyle',
      'Material',
      'Surface',
      'UserValue',
      'Scatter',
      'HitAccuracy',
      'HitHeight',
      'Orientation',
      'Radius',
      'FallThrough',
      'Legacy',
    ],
    readOnlyProperties: ['LastCapturedBall'],
    methods: [
      { name: 'CreateBall', signature: '(): IBall' },
      { name: 'CreateSizedBall', signature: '(radius: number): IBall' },
      { name: 'CreateSizedBallWithMass', signature: '(radius: number, mass: number): IBall' },
      { name: 'DestroyBall', signature: '(): number' },
      { name: 'Kick', signature: '(angle: number, speed: number, inclination?: number)' },
      {
        name: 'KickXYZ',
        signature: '(angle: number, speed: number, inclination: number, x: number, y: number, z: number)',
      },
      { name: 'KickZ', signature: '(angle: number, speed: number, inclination: number, heightz: number)' },
      { name: 'BallCntOver', signature: '(): number' },
    ],
  },

  Gate: {
    properties: [
      'Name',
      'TimerEnabled',
      'TimerInterval',
      'Length',
      'Height',
      'Rotation',
      'X',
      'Y',
      'Open',
      'Damping',
      'GravityFactor',
      'Material',
      'Elasticity',
      'Surface',
      'UserValue',
      'CloseAngle',
      'OpenAngle',
      'Collidable',
      'Friction',
      'Visible',
      'TwoWay',
      'ShowBracket',
      'ReflectionEnabled',
      'DrawStyle',
    ],
    readOnlyProperties: ['CurrentAngle'],
    methods: [{ name: 'Move', signature: '(dir: number, speed?: number, angle?: number)' }],
  },

  Spinner: {
    properties: [
      'Name',
      'TimerEnabled',
      'TimerInterval',
      'Length',
      'Rotation',
      'Height',
      'Damping',
      'Image',
      'Material',
      'X',
      'Y',
      'Surface',
      'UserValue',
      'ShowBracket',
      'AngleMax',
      'AngleMin',
      'Elasticity',
      'Visible',
      'ReflectionEnabled',
    ],
    readOnlyProperties: ['CurrentAngle'],
  },

  Ramp: {
    properties: [
      'Name',
      'TimerEnabled',
      'TimerInterval',
      'HeightBottom',
      'HeightTop',
      'WidthBottom',
      'WidthTop',
      'Material',
      'Type',
      'Image',
      'ImageAlignment',
      'HasWallImage',
      'LeftWallHeight',
      'RightWallHeight',
      'UserValue',
      'VisibleLeftWallHeight',
      'VisibleRightWallHeight',
      'Elasticity',
      'Collidable',
      'HasHitEvent',
      'Threshold',
      'Visible',
      'Friction',
      'Scatter',
      'DepthBias',
      'WireDiameter',
      'WireDistanceX',
      'WireDistanceY',
      'ReflectionEnabled',
      'PhysicsMaterial',
      'OverwritePhysics',
    ],
  },

  Rubber: {
    properties: [
      'Name',
      'Height',
      'HitHeight',
      'HasHitEvent',
      'Thickness',
      'RotX',
      'RotZ',
      'RotY',
      'Material',
      'Image',
      'Elasticity',
      'ElasticityFalloff',
      'Collidable',
      'Visible',
      'Friction',
      'Scatter',
      'EnableStaticRendering',
      'EnableShowInEditor',
      'ReflectionEnabled',
      'TimerEnabled',
      'TimerInterval',
      'UserValue',
      'PhysicsMaterial',
      'OverwritePhysics',
    ],
  },

  HitTarget: {
    properties: [
      'TimerEnabled',
      'TimerInterval',
      'Visible',
      'Material',
      'UserValue',
      'Image',
      'X',
      'Y',
      'Z',
      'ScaleX',
      'ScaleY',
      'ScaleZ',
      'Orientation',
      'Name',
      'Elasticity',
      'ElasticityFalloff',
      'Collidable',
      'HasHitEvent',
      'Threshold',
      'Friction',
      'Scatter',
      'DisableLighting',
      'BlendDisableLighting',
      'BlendDisableLightingFromBelow',
      'ReflectionEnabled',
      'DepthBias',
      'DropSpeed',
      'IsDropped',
      'DrawStyle',
      'LegacyMode',
      'RaiseDelay',
      'PhysicsMaterial',
      'OverwritePhysics',
    ],
    readOnlyProperties: ['CurrentAnimOffset', 'HitThreshold'],
  },

  DropTarget: {
    properties: [
      'TimerEnabled',
      'TimerInterval',
      'Visible',
      'Material',
      'UserValue',
      'Image',
      'X',
      'Y',
      'Z',
      'ScaleX',
      'ScaleY',
      'ScaleZ',
      'Orientation',
      'Name',
      'Elasticity',
      'ElasticityFalloff',
      'Collidable',
      'HasHitEvent',
      'Threshold',
      'Friction',
      'Scatter',
      'DisableLighting',
      'BlendDisableLighting',
      'BlendDisableLightingFromBelow',
      'ReflectionEnabled',
      'DepthBias',
      'DropSpeed',
      'IsDropped',
      'DrawStyle',
      'LegacyMode',
      'RaiseDelay',
      'PhysicsMaterial',
      'OverwritePhysics',
    ],
    readOnlyProperties: ['CurrentAnimOffset', 'HitThreshold'],
  },

  Plunger: {
    properties: [
      'PullSpeed',
      'FireSpeed',
      'TimerEnabled',
      'TimerInterval',
      'X',
      'Y',
      'Width',
      'ZAdjust',
      'Surface',
      'Name',
      'UserValue',
      'Type',
      'Material',
      'Image',
      'AnimFrames',
      'TipShape',
      'RodDiam',
      'RingGap',
      'RingDiam',
      'RingWidth',
      'SpringDiam',
      'SpringGauge',
      'SpringLoops',
      'SpringEndLoops',
      'MechPlunger',
      'AutoPlunger',
      'Visible',
      'MechStrength',
      'ParkPosition',
      'Stroke',
      'ScatterVelocity',
      'MomentumXfer',
      'ReflectionEnabled',
    ],
    methods: [
      { name: 'PullBack', signature: '()' },
      { name: 'Fire', signature: '()' },
      { name: 'CreateBall', signature: '(): IBall' },
      { name: 'Position', signature: '(): number' },
      { name: 'PullBackandRetract', signature: '()' },
      { name: 'MotionDevice', signature: '(): number' },
    ],
  },

  Primitive: {
    properties: [
      'DisplayTexture',
      'Sides',
      'Visible',
      'Material',
      'SideColor',
      'DrawTexturesInside',
      'UserValue',
      'Image',
      'NormalMap',
      'X',
      'Y',
      'Z',
      'Size_X',
      'Size_Y',
      'Size_Z',
      'RotAndTra0',
      'RotX',
      'RotAndTra1',
      'RotY',
      'RotAndTra2',
      'RotZ',
      'RotAndTra3',
      'TransX',
      'RotAndTra4',
      'TransY',
      'RotAndTra5',
      'TransZ',
      'RotAndTra6',
      'ObjRotX',
      'RotAndTra7',
      'ObjRotY',
      'RotAndTra8',
      'ObjRotZ',
      'EdgeFactorUI',
      'CollisionReductionFactor',
      'Name',
      'EnableStaticRendering',
      'Elasticity',
      'ElasticityFalloff',
      'Collidable',
      'IsToy',
      'BackfacesEnabled',
      'HasHitEvent',
      'Threshold',
      'Friction',
      'Scatter',
      'DisableLighting',
      'BlendDisableLighting',
      'BlendDisableLightingFromBelow',
      'ReflectionEnabled',
      'Opacity',
      'AddBlend',
      'Color',
      'EnableDepthMask',
      'ReflectionProbe',
      'RefractionProbe',
      'DepthBias',
      'PhysicsMaterial',
      'OverwritePhysics',
      'ObjectSpaceNormalMap',
    ],
    readOnlyProperties: ['HitThreshold'],
    methods: [
      { name: 'PlayAnim', signature: '(startFrame: number, speed: number)' },
      { name: 'PlayAnimEndless', signature: '(speed: number)' },
      { name: 'StopAnim', signature: '()' },
      { name: 'ShowFrame', signature: '(frame: number)' },
      { name: 'ContinueAnim', signature: '(speed: number)' },
    ],
  },

  Textbox: {
    properties: [
      'BackColor',
      'FontColor',
      'Text',
      'Font',
      'Width',
      'Height',
      'Alignment',
      'IsTransparent',
      'DMD',
      'TimerEnabled',
      'TimerInterval',
      'X',
      'Y',
      'IntensityScale',
      'Name',
      'UserValue',
      'Visible',
    ],
  },

  TextBox: {
    properties: [
      'BackColor',
      'FontColor',
      'Text',
      'Font',
      'Width',
      'Height',
      'Alignment',
      'IsTransparent',
      'DMD',
      'TimerEnabled',
      'TimerInterval',
      'X',
      'Y',
      'IntensityScale',
      'Name',
      'UserValue',
      'Visible',
    ],
  },

  Flasher: {
    properties: [
      'Name',
      'X',
      'Y',
      'ImageAlignment',
      'Height',
      'RotZ',
      'RotY',
      'RotX',
      'Color',
      'ImageA',
      'ImageB',
      'DisplayTexture',
      'Opacity',
      'IntensityScale',
      'ModulateVsAdd',
      'UserValue',
      'Visible',
      'AddBlend',
      'DMD',
      'DepthBias',
      'Filter',
      'Amount',
      'TimerEnabled',
      'TimerInterval',
      'DMDWidth',
      'DMDHeight',
      'DMDPixels',
      'DMDColoredPixels',
      'VideoCapWidth',
      'VideoCapHeight',
      'VideoCapUpdate',
    ],
  },

  Decal: {
    properties: [
      'Rotation',
      'Image',
      'Width',
      'Height',
      'X',
      'Y',
      'Type',
      'Text',
      'SizingType',
      'FontColor',
      'Material',
      'Font',
      'HasVerticalText',
      'Surface',
    ],
  },

  Ball: {
    properties: [
      'X',
      'Y',
      'VelX',
      'VelY',
      'Z',
      'VelZ',
      'AngVelX',
      'AngVelY',
      'AngVelZ',
      'AngMomX',
      'AngMomY',
      'AngMomZ',
      'Color',
      'Image',
      'FrontDecal',
      'DecalMode',
      'UserValue',
      'Mass',
      'Radius',
      'ID',
      'Name',
      'BulbIntensityScale',
      'ReflectionEnabled',
      'PlayfieldReflectionScale',
      'ForceReflection',
      'Visible',
    ],
    methods: [{ name: 'DestroyBall', signature: '(): number' }],
  },

  LightSeq: {
    properties: [
      'Name',
      'Collection',
      'CenterX',
      'CenterY',
      'UpdateInterval',
      'TimerEnabled',
      'TimerInterval',
      'UserValue',
    ],
    methods: [
      { name: 'Play', signature: '(Animation: number, TailLength?: number, Repeat?: number, Pause?: number)' },
      { name: 'StopPlay', signature: '()' },
    ],
  },

  LightSequencer: {
    properties: [
      'Name',
      'Collection',
      'CenterX',
      'CenterY',
      'UpdateInterval',
      'TimerEnabled',
      'TimerInterval',
      'UserValue',
    ],
    methods: [
      { name: 'Play', signature: '(Animation: number, TailLength?: number, Repeat?: number, Pause?: number)' },
      { name: 'StopPlay', signature: '()' },
    ],
  },

  Reel: {
    properties: [
      'BackColor',
      'Image',
      'Reels',
      'Width',
      'Height',
      'Spacing',
      'IsTransparent',
      'Sound',
      'Steps',
      'TimerEnabled',
      'TimerInterval',
      'X',
      'Y',
      'Range',
      'Name',
      'UpdateInterval',
      'UserValue',
      'UseImageGrid',
      'Visible',
      'ImagesPerGridRow',
    ],
    methods: [
      { name: 'AddValue', signature: '(Value: number)' },
      { name: 'ResetToZero', signature: '()' },
      { name: 'SpinReel', signature: '(ReelNumber: number, PulseCount: number)' },
      { name: 'SetValue', signature: '(Value: number)' },
    ],
  },

  Table: {
    properties: [
      'GlassHeight',
      'PlayfieldMaterial',
      'BackdropColor',
      'SlopeMax',
      'SlopeMin',
      'Inclination',
      'FieldOfView',
      'Layback',
      'Rotation',
      'Scalex',
      'Scaley',
      'Scalez',
      'Xlatex',
      'Xlatey',
      'Xlatez',
      'Gravity',
      'Friction',
      'Elasticity',
      'ElasticityFalloff',
      'Scatter',
      'DefaultScatter',
      'NudgeTime',
      'PlungerNormalize',
      'PhysicsLoopTime',
      'PlungerFilter',
      'YieldTime',
      'BallImage',
      'BackdropImage_DT',
      'BackdropImage_FS',
      'BackdropImage_FSS',
      'BackdropImageApplyNightDay',
      'ColorGradeImage',
      'Width',
      'Height',
      'MaxSeparation',
      'ZPD',
      'Offset',
      'GlobalStereo3D',
      'BallDecalMode',
      'Image',
      'Name',
      'EnableAntialiasing',
      'EnableAO',
      'EnableFXAA',
      'EnableSSR',
      'BloomStrength',
      'BallFrontDecal',
      'OverridePhysics',
      'OverridePhysicsFlippers',
      'EnableEMReels',
      'EnableDecals',
      'ReflectElementsOnPlayfield',
      'EnvironmentImage',
      'BackglassMode',
      'Accelerometer',
      'AccelNormalMount',
      'AccelerometerAngle',
      'GlobalDifficulty',
      'TableHeight',
      'DeadZone',
      'LightAmbient',
      'Light0Emission',
      'LightHeight',
      'LightRange',
      'EnvironmentEmissionScale',
      'LightEmissionScale',
      'AOScale',
      'SSRScale',
      'TableSoundVolume',
      'TableMusicVolume',
      'TableAdaptiveVSync',
      'BallReflection',
      'PlayfieldReflectionStrength',
      'BallTrail',
      'TrailStrength',
      'BallPlayfieldReflectionScale',
      'DefaultBulbIntensityScale',
      'DetailLevel',
      'NightDay',
      'GlobalAlphaAcc',
      'GlobalDayNight',
      'Version',
      'VersionMajor',
      'VersionMinor',
      'VersionRevision',
      'VPBuildVersion',
      'Option',
    ],
    readOnlyProperties: ['FileName', 'ShowDT', 'ShowFSS'],
  },
};

const VPX_DEBUG_API: VpxItemApi = {
  properties: [],
  methods: [{ name: 'Print', signature: '(value)' }],
};

export const VPX_GLOBAL_API = {
  properties: [
    'MusicVolume',
    'DisableStaticPrerendering',
    'ShowCursor',
    'DMDWidth',
    'DMDHeight',
    'DMDPixels',
    'DMDColoredPixels',
  ],
  readOnlyProperties: [
    'LeftFlipperKey',
    'RightFlipperKey',
    'StagedLeftFlipperKey',
    'StagedRightFlipperKey',
    'LeftTiltKey',
    'RightTiltKey',
    'CenterTiltKey',
    'PlungerKey',
    'StartGameKey',
    'AddCreditKey',
    'AddCreditKey2',
    'MechanicalTilt',
    'LeftMagnaSave',
    'RightMagnaSave',
    'ExitGame',
    'LockbarKey',
    'UserDirectory',
    'TablesDirectory',
    'ScriptsDirectory',
    'PlatformOS',
    'PlatformCPU',
    'PlatformBits',
    'GetPlayerHWnd',
    'ActiveBall',
    'GameTime',
    'PreciseGameTime',
    'FrameIndex',
    'SystemTime',
    'ShowDT',
    'ShowFSS',
    'NightDay',
    'ActiveTable',
    'Version',
    'VersionMajor',
    'VersionMinor',
    'VersionRevision',
    'VPBuildVersion',
    'WindowWidth',
    'WindowHeight',
    'RenderingMode',
  ],
  methods: [
    {
      name: 'PlaySound',
      signature: '(Sound, LoopCount, Volume, pan, randompitch, pitch, usesame, restart, front_rear_fade)',
    },
    { name: 'PlayMusic', signature: '(str, Volume)' },
    { name: 'EndMusic', signature: '()' },
    { name: 'StopSound', signature: '(Sound)' },
    { name: 'SaveValue', signature: '(TableName, ValueName, Value)' },
    { name: 'LoadValue', signature: '(TableName, ValueName)' },
    { name: 'GetCustomParam', signature: '(index)' },
    { name: 'GetTextFile', signature: '(FileName)' },
    { name: 'BeginModal', signature: '()' },
    { name: 'EndModal', signature: '()' },
    { name: 'Nudge', signature: '(Angle, Force)' },
    { name: 'NudgeGetCalibration', signature: '(XMax, YMax, XGain, YGain, DeadZone, TiltSensitivity)' },
    { name: 'NudgeSetCalibration', signature: '(XMax, YMax, XGain, YGain, DeadZone, TiltSensitivity)' },
    { name: 'FireKnocker', signature: '(Count)' },
    { name: 'QuitPlayer', signature: '(CloseType)' },
    { name: 'GetBalls', signature: '()' },
    { name: 'GetElements', signature: '()' },
    { name: 'GetElementByName', signature: '(name)' },
    {
      name: 'UpdateMaterial',
      signature:
        '(name, wrapLighting, roughness, glossyImageLerp, thickness, edge, edgeAlpha, opacity, base, glossy, clearcoat, isMetal, opacityActive, elasticity, elasticityFalloff, friction, scatterAngle)',
    },
    {
      name: 'GetMaterial',
      signature:
        '(name, wrapLighting, roughness, glossyImageLerp, thickness, edge, edgeAlpha, opacity, base, glossy, clearcoat, isMetal, opacityActive, elasticity, elasticityFalloff, friction, scatterAngle)',
    },
    { name: 'UpdateMaterialPhysics', signature: '(name, elasticity, elasticityFalloff, friction, scatterAngle)' },
    { name: 'GetMaterialPhysics', signature: '(name, elasticity, elasticityFalloff, friction, scatterAngle)' },
    { name: 'MaterialColor', signature: '(name, newVal)' },
    { name: 'LoadTexture', signature: '(imageName, fileName)' },
    { name: 'GetSerialDevices', signature: '()' },
    { name: 'OpenSerial', signature: '(device)' },
    { name: 'CloseSerial', signature: '()' },
    { name: 'FlushSerial', signature: '()' },
    { name: 'SetupSerial', signature: '(baud, bits, parity, stopbit, rts, dtr)' },
    { name: 'ReadSerial', signature: '(size)' },
    { name: 'WriteSerial', signature: '(data)' },
  ],
};

export interface ParsedVariable {
  name: string;
  kind: 'dim' | 'const' | 'set';
}

export interface CompletionState {
  tableItems: { name: string; type: string }[];
  parsedFunctions: { name: string; type: string }[];
  parsedVariables: ParsedVariable[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addApiSuggestions(suggestions: any[], monaco: any, api: VpxItemApi, typeName: string): void {
  for (const prop of api.properties) {
    suggestions.push({
      label: prop,
      kind: monaco.languages.CompletionItemKind.Property,
      insertText: prop,
      detail: typeName,
    });
  }
  for (const prop of api.readOnlyProperties || []) {
    suggestions.push({
      label: prop,
      kind: monaco.languages.CompletionItemKind.Property,
      insertText: prop,
      detail: `${typeName} (read-only)`,
    });
  }
  for (const method of api.methods || []) {
    suggestions.push({
      label: method.name,
      kind: monaco.languages.CompletionItemKind.Method,
      insertText: method.name,
      detail: `${typeName} ${method.signature}`,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerVbsCompletionProvider(monaco: any, getState: () => CompletionState): void {
  monaco.languages.registerCompletionItemProvider('vb', {
    triggerCharacters: ['.'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideCompletionItems: (model: any, position: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestions: any[] = [];
      const { tableItems, parsedFunctions, parsedVariables } = getState();
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);
      const dotMatch = textBeforeCursor.match(/(\w+)\.\s*$/);

      if (dotMatch) {
        const objName = dotMatch[1];

        if (objName.toLowerCase() === 'debug') {
          addApiSuggestions(suggestions, monaco, VPX_DEBUG_API, 'Debug');
          return { suggestions };
        }

        const item = tableItems.find((i: { name: string }) => i.name.toLowerCase() === objName.toLowerCase());
        if (item) {
          const api = VPX_ITEM_API[item.type];
          if (api) {
            addApiSuggestions(suggestions, monaco, api, item.type);
          }
        }
        return { suggestions };
      }

      for (const item of tableItems) {
        suggestions.push({
          label: item.name,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: item.name,
          detail: item.type,
        });
      }
      for (const method of VPX_GLOBAL_API.methods) {
        suggestions.push({
          label: method.name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: method.name,
          detail: method.signature,
        });
      }
      for (const prop of VPX_GLOBAL_API.properties) {
        suggestions.push({
          label: prop,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: prop,
          detail: 'VPinball',
        });
      }
      for (const prop of VPX_GLOBAL_API.readOnlyProperties) {
        suggestions.push({
          label: prop,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: prop,
          detail: 'VPinball (read-only)',
        });
      }
      for (const fn of parsedFunctions) {
        suggestions.push({
          label: fn.name,
          kind:
            fn.type === 'sub'
              ? monaco.languages.CompletionItemKind.Method
              : monaco.languages.CompletionItemKind.Function,
          insertText: fn.name,
          detail: fn.type,
        });
      }
      for (const v of parsedVariables) {
        suggestions.push({
          label: v.name,
          kind:
            v.kind === 'const'
              ? monaco.languages.CompletionItemKind.Constant
              : monaco.languages.CompletionItemKind.Variable,
          insertText: v.name,
          detail: v.kind,
        });
      }
      suggestions.push({
        label: 'Debug',
        kind: monaco.languages.CompletionItemKind.Module,
        insertText: 'Debug',
        detail: 'Debug.Print',
      });
      return { suggestions };
    },
  });
}

export function parseScriptVariables(code: string): ParsedVariable[] {
  const variables: ParsedVariable[] = [];
  const seen = new Set<string>();
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    const dimMatch = trimmed.match(/^\s*Dim\s+(.+)/i);
    if (dimMatch) {
      const vars = dimMatch[1].split(',');
      for (const v of vars) {
        const name = v.trim().replace(/\(.*\)/, '');
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          variables.push({ name, kind: 'dim' });
        }
      }
      continue;
    }

    const constMatch = trimmed.match(/^\s*Const\s+(\w+)/i);
    if (constMatch) {
      const name = constMatch[1];
      if (!seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        variables.push({ name, kind: 'const' });
      }
      continue;
    }

    const setMatch = trimmed.match(/^\s*Set\s+(\w+)\s*=/i);
    if (setMatch) {
      const name = setMatch[1];
      if (!seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        variables.push({ name, kind: 'set' });
      }
    }
  }

  return variables;
}
