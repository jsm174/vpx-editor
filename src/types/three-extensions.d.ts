import 'three/addons/controls/OrbitControls.js';

declare module 'three/addons/controls/OrbitControls.js' {
  interface OrbitControls {
    mouseButtons: {
      LEFT: THREE.MOUSE | null;
      MIDDLE: THREE.MOUSE;
      RIGHT: THREE.MOUSE;
    };
  }
}
