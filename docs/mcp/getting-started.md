# MCP authoring in VPX Editor

MCP is available in the desktop editor. Open **Tools → MCP Server → Settings**, enable the server, and copy the displayed connection command into your MCP client setup. The endpoint binds to localhost and requires the bearer token shown by the editor. Treat that token as a password; regenerating it disconnects existing sessions.

Start with `vpx_guide`. To create a table, call `vpx_new(action:"create", start:"glf", name:"MyMachine")`, or use `start:"blank"`. Inspect it with `vpx_table(action:"overview")` and `vpx_view()`.

Most editing tools preview by default; repeat with `confirm:true` to apply. Check each result for errors. Mesh imports and new-table creation apply immediately. Save with `vpx_save`: a new table opens a native Save dialog. Unsaved tables live in a temporary folder.

A session attaches to one table. Focusing a different window does not change its target. After closing or unloading the attached table, explicitly select another with `vpx_table(action:"windows")` followed by `vpx_table(action:"attach", windowId:"...")`.

Edits from MCP clients sharing a table are serialized. Direct file edits wait for the renderer to update and create one undo record containing the changed metadata and binary files. Use `vpx_history` to undo or redo. A failed edit restores its touched files; a reported rollback failure requires inspection before continuing. Wait for manual edits to finish before retrying a busy response.

See [GLF tables](glf-tables.md) and [MPF export](mpf-workflow.md).

## Development and verification

Run `npm ci` for a fresh checkout. The postinstall step downloads vendor scripts and templates pinned by commit and checksums in `resources/vendor.json`. For an existing checkout, run `npm run vendor` to restore missing resources. Verify them without downloads with `node scripts/fetch-vendor.mjs --check`.

Run `npm run typecheck` and `npm test`. The server tests require permission to bind a loopback port. Integration tests use the real vendored templates and GLF framework; missing resources are failures, not silently skipped tests.

Run `npm run package` followed by `npm run test:desktop` for an automated desktop smoke test. It opens an isolated editor with temporary settings, exercises two MCP clients and real renderer undo/redo, saves a disposable VPX, and removes its test tables afterward.

For a manual desktop check, connect two clients to the same table, add different materials concurrently, and verify both exist. Replace/delete an image and sound, and import a mesh; undo and redo each, then save and reopen the VPX. Verify GLF device undo restores both script and collection membership. Close an attached window and verify repeated requests remain detached until an explicit attach.
