# MCP authoring in VPX Editor

MCP is available in the desktop editor. Open **Tools → MCP Server → Settings…**, enable the server, and follow the setup steps for your client. The dialog shows the two values every client needs:

- **Endpoint**: `http://127.0.0.1:<port>/mcp`. The server only listens on this computer.
- **Access token**: sent as `Authorization: Bearer <token>` on every request. Treat it like a password. Regenerating it disconnects every client until each one is set up again with the new token.

Pick your client in the **Set up a client** section and the dialog shows the exact command or config block with the endpoint and token already filled in. Claude Code and Codex CLI are supported. The same instructions are summarized below with `<endpoint>` and `<token>` placeholders. Other MCP clients that accept an HTTP URL plus an `Authorization` header should work with the same two values, but they are untested.

If a client tries to connect without the token, or with an old one, the dialog's status area says so and the editor console logs the rejection. The server also answers with a 401 whose body explains where to find the token.

## Claude Code

Run this once in a terminal, then start or restart Claude Code:

```
claude mcp add --transport http vpx <endpoint> --header "Authorization: Bearer <token>"
```

Ask Claude Code to run `vpx_guide` to confirm the connection. If Claude Code reports "Dynamic Client Registration rejected", the header is missing or stale: remove the server with `claude mcp remove vpx` and add it again with the current token.

## Codex CLI

Add this block to `~/.codex/config.toml` (`%USERPROFILE%\.codex\config.toml` on Windows) and restart Codex CLI:

```toml
[mcp_servers.vpx]
url = "<endpoint>"
http_headers = { Authorization = "Bearer <token>" }
```

`codex mcp list` should then show `vpx`. If you would rather keep the token out of the config file, export it as an environment variable and register the server with `codex mcp add vpx --url <endpoint> --bearer-token-env-var VPX_MCP_TOKEN`.

## First steps once connected

Start with `vpx_guide`. To create a table, call `vpx_new(action:"create", start:"glf", name:"MyMachine", dir:"/path/to/project")`, or use `start:"blank"`. The `dir` argument saves the table straight into that folder as `MyMachine.vpx` with no Save dialog. Assistants are told to pass their working directory, so a table created from a Claude Code or Codex session lands next to the files you are working on. Inspect it with `vpx_table(action:"overview")` and `vpx_view()`.

Script, material, image, sound, and part-delete edits preview by default; repeat with `confirm:true` to apply. `vpx_part` add and modify apply immediately unless `preview:true` is passed, as do `vpx_history`, mesh imports, MPF generation, and new-table creation. Check each result for errors. Save with `vpx_save`. Pass `path` (a folder or a full `.vpx` path) to save somewhere specific without a dialog; the editor keeps using that location afterwards. Without `path`, a table that has never been saved opens the native Save dialog. Unsaved tables live in a temporary folder.

A session attaches to one table. Focusing a different window does not change its target. After closing or unloading the attached table, explicitly select another with `vpx_table(action:"windows")` followed by `vpx_table(action:"attach", windowId:"...")`.

Edits from MCP clients sharing a table are serialized. Direct file edits wait for the renderer to update and create one undo record containing the changed metadata and binary files. Use `vpx_history` to undo or redo. A failed edit restores its touched files; a reported rollback failure requires inspection before continuing. Wait for manual edits to finish before retrying a busy response.

See [GLF tables](glf-tables.md) and [MPF export](mpf-workflow.md).

## Troubleshooting

- **Status says "enabled but not running"**: another program holds the port. The editor tries the next nine ports automatically; the status line shows which one it picked. Change the port in the dialog if it keeps failing.
- **Client sees 401 or "unauthorized"**: the token is missing or stale. Reopen the dialog, copy the current token, and redo the client setup. The dialog shows when the last rejected attempt happened and whether the token was missing or wrong.
- **Client lists no tools**: the editor was not running when the client started. Start the editor first, then restart the client.

## Development and verification

Run `npm ci` for a fresh checkout. The postinstall step downloads vendor scripts and templates pinned by commit and checksums in `resources/vendor.json`. For an existing checkout, run `npm run vendor` to restore missing resources. Verify them without downloads with `node scripts/fetch-vendor.mjs --check`.

Run `npm run typecheck` and `npm test`. The server tests require permission to bind a loopback port. Integration tests use the real vendored templates and GLF framework; missing resources are failures, not silently skipped tests.

Run `npm run package` followed by `npm run test:desktop` for an automated desktop smoke test. It opens an isolated editor with temporary settings, exercises two MCP clients and real renderer undo/redo, saves a disposable VPX, and removes its test tables afterward.

For a manual desktop check, connect two clients to the same table, add different materials concurrently, and verify both exist. Replace/delete an image and sound, and import a mesh; undo and redo each, then save and reopen the VPX. Verify GLF device undo restores both script and collection membership. Close an attached window and verify repeated requests remain detached until an explicit attach.
