---
name: review-vpx-editor
description: Review vpx-editor changes against vpin and vpinball-macos for correctness, parity with the Windows VPX editor, and adherence to project conventions. Use when reviewing PRs, branches, or specific files.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Agent
argument-hint: "[branch-or-file]"
---

# vpx-editor Review

Review changes in `vpx-editor` against two upstream sources of truth and against the project's own conventions:

- `~/vpx/vpin` — the Rust crate that owns the VPX file format, OBJ/MTL I/O, and the wasm bindings vpx-editor uses (`@francisdb/vpin-wasm`).
- `~/vpx/vpinball-macos` — the C++ Visual Pinball source. The Windows editor's behavior is the spec; standalone (macOS/Linux) is the same source tree with `__STANDALONE__` guards.

Both are kept locally checked out and updated. Always read the latest `master` of each before judging correctness — do not rely on cached recollection of either codebase.

## Steps

1. **Get the diff**. If `$ARGUMENTS` is a file path, diff that file. Otherwise, diff the current branch against master:
   ```
   git diff master...HEAD
   ```

2. **For changes that touch domain behavior** (mesh handling, primitives, materials, lights, flashers, ramps, walls, gameitems, BIFF I/O, vpx-format anything) locate the corresponding logic in:
   - `~/vpx/vpinball-macos/src/parts/` (gameitem behavior, dialogs, importers/exporters)
   - `~/vpx/vpinball-macos/src/utils/` (shared helpers like `objloader.cpp`)
   - `~/vpx/vpin/src/vpx/` (the canonical Rust model — what gets written to disk)
   - `~/vpx/vpin/src/wavefront_obj_io.rs`, `~/vpx/vpin/src/vpx/obj.rs` (OBJ I/O)
   - `~/vpx/vpin/src/wasm.rs` (the surface vpx-editor actually calls)

   Read the full corresponding source on both sides before flagging anything. The Windows editor is the reference behavior; vpin is the data contract.

3. **Check for the categories below.** When in doubt about whether something is correct, prefer matching the Windows editor's user-visible behavior over a "cleaner" alternative — parity is the goal.

### Parity with the Windows VPX editor
- Default values for new gameitems, dialog defaults, checkbox defaults must match `vpinball-macos` (`src/parts/<thing>.cpp`, dialog `IDD_*` handlers).
- When porting a feature from the Windows editor, every option/checkbox the Windows dialog exposes should have a corresponding control in our shared component — not silently dropped.
- Coordinate-system conversions, V-flips, winding reversals, and triangulation rules must match the Windows editor's loader (e.g. `ObjLoader::Load` for OBJ import). Verify each transformation by tracing one corner/face/normal through both pipelines.
- BIFF tag names, field order, and conditional writes must match what `vpin` reads/writes — extracted JSON keys map to vpin's serde field names, not to invented ones.

### Data contract with vpin
- Anything that ends up in the extracted directory (OBJ files, JSON gameitems, materials.json, etc.) must round-trip through vpin: extract → write → re-assemble must produce a byte-identical vpx (or a documented, intentional deviation).
- The OBJ-on-disk format is **vpinball dialect** — combined per-corner vertices, fan-triangulated, vpinball-side V/Z conventions. If a change writes an OBJ, verify vpin's `VpxObjReader` (`src/vpx/obj.rs`) can ingest it. vpin's reader assumes parallel `v[]`/`vt[]`/`vn[]` arrays of equal length and only uses each face's first three corners with the v-index — non-conforming OBJs silently corrupt the mesh, they do not error.
- JSON field names for gameitems must match the `serde(rename = ...)` attributes in `vpin/src/vpx/gameitem/*.rs`. Don't invent or rename keys.
- When vpin gains new fields (check `vpin/CHANGELOG.md` and recent `vpin/src/vpx/` commits), surface them in vpx-editor or document why they're skipped.

### Desktop / web parity
- Every feature must work on **both** Electron desktop and the web build. If a change only updates `src/desktop/` or only updates `src/web/`, that's almost always a bug — flag it.
- Shared logic belongs in `src/features/<name>/shared/` or `src/shared/`. Desktop and web should be thin adapters over the shared module:
  - `src/features/<name>/desktop/` for Electron-specific bits (file dialogs, IPC, BrowserWindow plumbing).
  - `src/features/<name>/web/` for browser-specific bits (File API, download blobs, in-page modals).
- Look for **duplicated logic** between desktop and web — parsers, validators, formatters, business rules. Any duplication is a refactor target. The mesh-import preprocessor was duplicated for months and the two copies drifted (#45) — don't let that happen again.
- IPC handlers in `src/desktop/main.ts` and the corresponding web stub in `src/web/api-stub.ts` must expose the same surface. If desktop adds an option/argument, the web stub gets the same option/argument.
- When the desktop window template (`features/<name>/desktop/window.html`) has UI controls, the desktop window's `.ts` must read all of them and forward them through IPC — don't ship dead checkboxes.

### TypeScript and code quality
- Prefer editing existing files; avoid creating new ones unless the new file genuinely belongs in a new feature folder.
- No new comments unless the *why* is non-obvious. Don't restate what the code does.
- No new `any`. If a value's shape is unknown at a boundary, type it explicitly (`unknown` + narrow, or a defined interface).
- No invented validation/clamping/fallback paths for cases that can't happen. Trust internal callers; only validate at boundaries (file I/O, IPC, user input, network).
- No new dependencies without a clear justification — prefer extending what's already in `package.json`.
- No new top-level state in modules that already have a state container.
- Don't add backwards-compat shims for code that's being deleted. If a symbol is unused, delete it.
- File and identifier naming should follow what's already in the surrounding folder (kebab-case filenames, camelCase functions, PascalCase types/components).

### Build hygiene
- `npx tsc --noEmit` must pass. Run it.
- `package.json` and `package-lock.json` must agree. If a dep was bumped, the lockfile must reflect it.
- Don't bump `@francisdb/vpin-wasm` without checking `vpin/CHANGELOG.md` for breaking changes — wasm API changes ripple into `src/platform/vpx-engine.ts` and consumers.
- Don't commit anything from `dist/`, `dist-web/`, `out/`, or `.vite/`.

## Output Format

For each issue found, report:
- **File and line number** in vpx-editor
- **What the reference does** (vpinball-macos file:line, or vpin file:line, or the existing shared module)
- **What this change does differently**
- **Severity**:
  - `WRONG` — breaks parity with the Windows editor or the vpin data contract
  - `MISSING` — incomplete (a Windows option not exposed, a vpin field not surfaced, a desktop/web adapter not updated)
  - `DESKTOP-WEB-DRIFT` — change applied on one side only, or logic duplicated instead of shared
  - `INVENTED` — adds behavior, validation, or fields not in the reference
  - `QUALITY` — TypeScript, naming, dead code, dependency, or hygiene issue

Summarize with a count of issues by severity at the end.
