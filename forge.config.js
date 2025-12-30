const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const packagerConfig = {
  asar: true,
  executableName: 'vpx-editor',
  extraResource: ['resources/vpxtool', 'resources/templates', 'resources/about-icon.png'],
  icon: './resources/icon',
};

if (process.env.MACOS_CODESIGN === '1') {
  packagerConfig.osxSign = {
    identity: process.env.MACOS_CODESIGN_DEVELOPER_ID,
  };
  packagerConfig.osxNotarize = {
    appleId: process.env.MACOS_CODESIGN_APPLE_ID,
    appleIdPassword: process.env.MACOS_CODESIGN_PASSWORD,
    teamId: process.env.MACOS_CODESIGN_TEAM_ID,
  };
}

module.exports = {
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
      platforms: ['linux', 'win32'],
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
      // debug this using:
      //   DEBUG=electron-installer-flatpak,@malept/flatpak-bundler npm run make
      config: {
        options: {
          id: 'com.github.jsm174.vpxeditor',
          branch: (() => {
            const version = require('./package.json').version;
            try {
              const versionInfo = require('./src/shared/version.json');
              return `${version}-${versionInfo.revision}-${versionInfo.sha}`;
            } catch {
              return version;
            }
          })(),
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
            // "--talk-name=org.freedesktop.Notifications",
            // "--talk-name=org.freedesktop.secrets",
            '--filesystem=home',
          ],
          modules: [
            {
              // https://github.com/electron/forge/issues/2805
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
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload/index.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/preload/image-manager.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/preload/script-editor.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/preload/material-manager.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/preload/sound-manager.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/preload/render-probe-manager.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/preload/search-select.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
          {
            entry: 'src/preload/dimensions-manager.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
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
};
