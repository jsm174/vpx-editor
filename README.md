# VPX Editor

A cross-platform editor for Visual Pinball X (.vpx) table files.

<p align="center">
  <img src="docs/screenshots/screenshot-2d.png" alt="2D Editor View">
</p>
<p align="center">
  <img src="docs/screenshots/screenshot-3d.png" alt="3D Preview">
</p>
<p align="center">
  <img src="docs/screenshots/screenshot-vr.png" alt="VR Preview">
</p>
<p align="center">
  <img src="docs/screenshots/screenshot-script-editor.png" alt="Script Editor">
</p>

## Overview

VPX Editor is a cross-platform table editor for [Visual Pinball](https://github.com/vpinball/vpinball), built with [Electron](https://www.electronjs.org/) and [Three.js](https://threejs.org/). It uses [vpxtool](https://github.com/francisdb/vpxtool) to extract and assemble VPX files.

This project was initially created with the assistance of Claude AI.

> [!WARNING]
> **Always make a backup of your VPX files before editing!** This editor is in early development and is bound to have bugs.

> [!NOTE]
> This editor converts tables to use **Part Groups** instead of Layers, a new feature introduced in VPX 10.8.1. Tables saved with this editor require **VPinball 10.8.1 or later** to run.

> [!NOTE]
> The new **Ball** element (introduced in 10.8.1) is not yet supported by vpxtool.

## Features

### 2D Editor
Port of the Windows VPX 2D editor:
- All playfield elements (walls, ramps, flippers, bumpers, lights, etc.)
- Drag-and-drop object placement
- Multi-select and transform operations

### Managers
- **Sound Manager** - Manage audio assets
- **Image Manager** - Import, export, and manage table images
- **Material Manager** - Edit PBR material properties
- **Dimension Manager** - Reference real pinball machine dimensions
- **Collection Manager** - Organize objects into named groups
- **Render Probe Manager** - Configure reflection probes

### Script Editor
- Monaco-based VBScript editor
- Syntax highlighting

### 3D Preview
- Real-time 3D rendering with Three.js
- Blender-style controls
- Material and texture preview
- Wireframe mode

### VR Preview
- 3D VR cabinet view

### Quick Play
- Configure VPinball executable path in settings
- Launch and test tables directly from the editor

## 3D Controls

Blender-style navigation:

| Input | Action |
|-------|--------|
| Middle-drag | Orbit camera |
| Shift + Middle-drag | Pan camera |
| Scroll wheel | Zoom |
| Numpad 1 | Front view |
| Numpad 3 | Side view |
| Numpad 7 | Top view |
| Ctrl + Numpad | Opposite views |
| Alt (hold) | Temporary orbit mode |

## Requirements

- **Node.js** 20+
- **VPinball 10.8.1+** - Required only for playing tables from the editor

## Getting Started

```bash
npm install
```

### Run Locally

```bash
npm start
```

Launches the app in development mode with hot reload.

### Build Release

```bash
npm run make
```

Creates distributable packages for the current platform:

| Platform | Format | Architecture |
|----------|--------|--------------|
| macOS | DMG | arm64 |
| Linux | DEB, RPM, Flatpak, ZIP | x64 |
| Windows | Squirrel Installer | x64 |

#### Flatpak issues

If you have issues building the flatpak try this first:

```bash
flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

To get more output during the flatpak build:

```bash
DEBUG=electron-installer-flatpak,@malept/flatpak-bundler npm run make
```

### Code Formatting

```bash
npm run format
```

## Architecture

```
src/
├── main/           # Electron main process
├── preload/        # IPC bridges for windows
├── editor/         # 2D canvas and 3D WebGL rendering
│   └── objects/    # Per-type renderers
├── shared/         # Constants, utilities, helpers
└── windows/        # Manager windows and dialogs
    ├── dialogs/
    ├── managers/
    └── settings/
```

## Acknowledgments

- [Visual Pinball](https://github.com/vpinball/vpinball)
- [vpxtool](https://github.com/francisdb/vpxtool)
- [Three.js](https://threejs.org/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## License

This project is licensed under the GNU General Public License v3.0 or later - see the [LICENSE](LICENSE) file for details.

This matches the license used by [Visual Pinball](https://github.com/vpinball/vpinball).
