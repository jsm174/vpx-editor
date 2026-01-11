import type { Platform } from './types.js';

export * from './types.js';

let platformInstance: Platform | null = null;

export function detectPlatform(): 'electron' | 'web' {
  if (typeof window !== 'undefined' && (window as any).process?.type === 'renderer') {
    return 'electron';
  }

  if (typeof process !== 'undefined' && process.versions?.electron) {
    return 'electron';
  }

  return 'web';
}

export async function createPlatform(): Promise<Platform> {
  if (platformInstance) {
    return platformInstance;
  }

  const platformType = detectPlatform();

  if (platformType === 'electron') {
    const { createElectronPlatform } = await import('./desktop/index.js');
    platformInstance = createElectronPlatform();
  } else {
    const { createWebPlatform } = await import('./web/index.js');
    platformInstance = createWebPlatform();
  }

  await platformInstance.init();
  return platformInstance;
}

export function getPlatform(): Platform {
  if (!platformInstance) {
    throw new Error('Platform not initialized. Call createPlatform() first.');
  }
  return platformInstance;
}

export function isElectron(): boolean {
  return detectPlatform() === 'electron';
}

export function isWeb(): boolean {
  return detectPlatform() === 'web';
}
