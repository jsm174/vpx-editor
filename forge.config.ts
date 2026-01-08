import type { ForgeConfig } from '@electron-forge/shared-types';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import packageJson from './package.json';

interface PackagerConfig {
  asar: boolean;
  executableName: string;
  extraResource: string[];
  icon: string;
  osxSign?: {
    identity: string | undefined;
  };
  osxNotarize?: {
    appleId: string;
    appleIdPassword: string;
    teamId: string;
  };
}

const packagerConfig: PackagerConfig = {
  asar: true,
  executableName: 'vpx-editor',
  extraResource: ['resources/vpxtool', 'resources/templates'],
  icon: './resources/icon',
};

if (process.env.MACOS_CODESIGN === '1') {
  const appleId = process.env.MACOS_CODESIGN_APPLE_ID;
  const appleIdPassword = process.env.MACOS_CODESIGN_PASSWORD;
  const teamId = process.env.MACOS_CODESIGN_TEAM_ID;

  packagerConfig.osxSign = {
    identity: process.env.MACOS_CODESIGN_DEVELOPER_ID,
  };
  if (appleId && appleIdPassword && teamId) {
    packagerConfig.osxNotarize = {
      appleId,
      appleIdPassword,
      teamId,
    };
  }
}

const getFlatpakBranch = (): string => {
  const version = packageJson.version;
  try {
    const versionInfo = require('./src/shared/version.json');
    return `${version}-${versionInfo.revision}-${versionInfo.sha}`;
  } catch {
    return version;
  }
};

const config: ForgeConfig = {
  packagerConfig,
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32'],
      config: {},
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
    {
      name: '@electron-forge/maker-flatpak',
      config: {
        options: {
          id: 'com.github.jsm174.vpxeditor',
          branch: getFlatpakBranch(),
          categories: ['Game', 'Utility'],
          genericName: 'Visual Pinball Table Editor',
          runtime: 'org.freedesktop.Platform',
          runtimeVersion: '25.08',
          sdk: 'org.freedesktop.Sdk',
          base: 'org.electronjs.Electron2.BaseApp',
          baseVersion: '25.08',
          finishArgs: [
            '--share=network',
            '--share=ipc',
            '--socket=x11',
            '--socket=wayland',
            '--socket=pulseaudio',
            '--device=dri',
            '--talk-name=org.freedesktop.Flatpak',
            '--filesystem=home',
          ],
          modules: [
            {
              name: 'zypak',
              sources: [
                {
                  type: 'git',
                  url: 'https://github.com/refi64/zypak',
                  tag: 'v2025.09',
                },
              ],
            },
          ],
        },
      },
    },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/preload/image-manager.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/preload/script-editor.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/preload/material-manager.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/preload/sound-manager.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/preload/render-probe-manager.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/preload/search-select.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/preload/dimensions-manager.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'jsm174',
          name: 'vpx-editor',
        },
        prerelease: false,
      },
    },
  ],
};

export default config;
