// Run after npm run package. Uses isolated settings and disposable tables.
const { app, BrowserWindow, dialog, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const net = require('node:net');
const repo = process.cwd();
const { Client } = require(path.join(repo, 'node_modules/@modelcontextprotocol/sdk/dist/cjs/client/index.js'));
const { StreamableHTTPClientTransport } = require(
  path.join(repo, 'node_modules/@modelcontextprotocol/sdk/dist/cjs/client/streamableHttp.js')
);
const clients = [],
  tempTables = [];
let temp;
async function finish(code) {
  clearTimeout(deadline);
  await Promise.allSettled(clients.map(c => c.close()));
  for (const w of BrowserWindow.getAllWindows()) w.destroy();
  for (const dir of tempTables) await fs.rm(dir, { recursive: true, force: true });
  if (temp) await fs.rm(temp, { recursive: true, force: true });
  app.exit(code);
}
const deadline = setTimeout(() => {
  console.error('SMOKE FAIL: overall timeout');
  void finish(1);
}, 150000);
(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'vpx-mcp-smoke-'));
  app.setPath('userData', temp);
  app.getAppPath = () => repo;
  const server = net.createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  await new Promise(r => server.close(r));
  const token = require('node:crypto').randomBytes(24).toString('hex');
  await fs.writeFile(path.join(temp, 'settings.json'), JSON.stringify({ mcp: { enabled: true, port, token } }));
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: path.join(temp, 'Smoke.vpx') });
  dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
  require(path.join(repo, '.vite/build/main.js'));
  await app.whenReady();
  for (let i = 0; i < 100; i++) {
    if (BrowserWindow.getAllWindows().some(w => !w.webContents.isLoading())) break;
    await new Promise(r => setTimeout(r, 100));
  }
  async function connect() {
    const client = new Client({ name: 'vpx-smoke', version: '1' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      })
    );
    clients.push(client);
    return client;
  }
  const a = await connect(),
    b = await connect();
  async function call(client, name, args = {}) {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`${name}: ${JSON.stringify(result.content)}`);
    return result.structuredContent ?? JSON.parse(result.content.find(c => c.type === 'text').text);
  }
  const created = await call(a, 'vpx_new', { action: 'create', start: 'glf', name: 'McpSmoke' });
  const root = created.workDir;
  tempTables.push(path.dirname(root));
  const firstWindow = BrowserWindow.getAllWindows().find(w => w.getTitle().includes('McpSmoke'));
  assert(firstWindow);
  const windows = await call(a, 'vpx_table', { action: 'windows' });
  await call(b, 'vpx_table', { action: 'attach', windowId: windows.windows[0].windowId });
  await Promise.all(
    [a, b].map((c, i) => call(c, 'vpx_material', { action: 'add', material: { name: `Smoke${i}` }, confirm: true }))
  );
  const mats = await call(a, 'vpx_material', { action: 'list' });
  assert(mats.materials.some(m => m.name === 'Smoke0') && mats.materials.some(m => m.name === 'Smoke1'));
  console.log('SMOKE PASS concurrent materials');
  const png = rgba => nativeImage.createFromBitmap(Buffer.from(rgba), { width: 1, height: 1 }).toPNG();
  const old = png([0, 0, 255, 255]),
    next = png([255, 0, 0, 255]);
  await call(a, 'vpx_image', {
    action: 'add',
    name: 'SmokeArt',
    source: { base64: old.toString('base64') },
    confirm: true,
  });
  await call(a, 'vpx_image', {
    action: 'modify',
    name: 'SmokeArt',
    source: { base64: next.toString('base64') },
    confirm: true,
  });
  await call(a, 'vpx_history', { action: 'undo' });
  assert.deepEqual(await fs.readFile(path.join(root, 'images/SmokeArt.png')), old);
  await call(a, 'vpx_history', { action: 'redo' });
  assert.deepEqual(await fs.readFile(path.join(root, 'images/SmokeArt.png')), next);
  await call(a, 'vpx_image', { action: 'delete', name: 'SmokeArt', confirm: true });
  await call(a, 'vpx_history', { action: 'undo' });
  assert.deepEqual(await fs.readFile(path.join(root, 'images/SmokeArt.png')), next);
  console.log('SMOKE PASS image replacement/deletion undo and redo');
  const wav = sample => {
    const out = Buffer.alloc(46);
    out.write('RIFF');
    out.writeUInt32LE(38, 4);
    out.write('WAVEfmt ', 8);
    out.writeUInt32LE(16, 16);
    out.writeUInt16LE(1, 20);
    out.writeUInt16LE(1, 22);
    out.writeUInt32LE(8000, 24);
    out.writeUInt32LE(16000, 28);
    out.writeUInt16LE(2, 32);
    out.writeUInt16LE(16, 34);
    out.write('data', 36);
    out.writeUInt32LE(2, 40);
    out.writeInt16LE(sample, 44);
    return out;
  };
  const oldSound = wav(0),
    newSound = wav(100);
  await call(a, 'vpx_sound', {
    action: 'add',
    name: 'SmokeSound',
    source: { base64: oldSound.toString('base64') },
    confirm: true,
  });
  await call(a, 'vpx_sound', {
    action: 'modify',
    name: 'SmokeSound',
    source: { base64: newSound.toString('base64') },
    confirm: true,
  });
  await call(a, 'vpx_history', { action: 'undo' });
  assert.deepEqual(await fs.readFile(path.join(root, 'sounds/SmokeSound.wav')), oldSound);
  await call(a, 'vpx_history', { action: 'redo' });
  assert.deepEqual(await fs.readFile(path.join(root, 'sounds/SmokeSound.wav')), newSound);
  await call(a, 'vpx_sound', { action: 'delete', name: 'SmokeSound', confirm: true });
  await call(a, 'vpx_history', { action: 'undo' });
  assert.deepEqual(await fs.readFile(path.join(root, 'sounds/SmokeSound.wav')), newSound);
  console.log('SMOKE PASS sound replacement/deletion undo and redo');
  await call(a, 'vpx_part', {
    action: 'add',
    part: { type: 'Primitive', name: 'SmokeMesh', position: { x: 200, y: 200 } },
  });
  const obj = path.join(temp, 'triangle.obj');
  await fs.writeFile(
    obj,
    'o triangle\nv 0 0 0\nv 10 0 0\nv 0 10 0\nvt 0 0\nvt 1 0\nvt 0 1\nvn 0 0 1\nf 1/1/1 2/2/1 3/3/1\n'
  );
  await call(a, 'vpx_mesh', { action: 'import', partName: 'SmokeMesh', path: obj, importMaterial: false });
  const entries = JSON.parse(await fs.readFile(path.join(root, 'gameitems.json'), 'utf8'));
  const meshEntry = entries.find(e => e.file_name.includes('SmokeMesh'));
  assert(meshEntry);
  const meshPath = path.join(root, 'gameitems', meshEntry.file_name.replace(/\.json$/, '.obj'));
  const imported = await fs.readFile(meshPath);
  await call(a, 'vpx_history', { action: 'undo' });
  await assert.rejects(fs.access(meshPath));
  await call(a, 'vpx_history', { action: 'redo' });
  assert.deepEqual(await fs.readFile(meshPath), imported);
  console.log('SMOKE PASS mesh import undo and redo');
  await call(a, 'vpx_part', {
    action: 'add',
    part: { type: 'Kicker', name: 'SmokeScoop', position: { x: 300, y: 300 } },
  });
  const scriptBefore = await fs.readFile(path.join(root, 'script.vbs'));
  const collectionsBefore = await fs.readFile(path.join(root, 'collections.json'));
  const wired = await call(a, 'vpx_glf', {
    action: 'add_device',
    device: 'ball_device',
    name: 'smoke_scoop',
    switches: ['SmokeScoop'],
    confirm: true,
  });
  assert(wired.applied, JSON.stringify(wired));
  const scriptAfter = await fs.readFile(path.join(root, 'script.vbs'));
  await call(a, 'vpx_history', { action: 'undo' });
  assert.deepEqual(await fs.readFile(path.join(root, 'script.vbs')), scriptBefore);
  assert.deepEqual(await fs.readFile(path.join(root, 'collections.json')), collectionsBefore);
  await call(a, 'vpx_history', { action: 'redo' });
  assert.deepEqual(await fs.readFile(path.join(root, 'script.vbs')), scriptAfter);
  console.log('SMOKE PASS GLF script and collection undo/redo');
  const saved = await call(a, 'vpx_save');
  assert(saved.saved);
  assert((await fs.stat(path.join(temp, 'Smoke.vpx'))).size > 0);
  const inspect = await call(a, 'vpx_library', { action: 'inspect', tablePath: path.join(temp, 'Smoke.vpx') });
  assert(inspect);
  console.log('SMOKE PASS save and VPX re-extraction');
  const second = await call(b, 'vpx_new', { action: 'create', start: 'blank', name: 'OtherSmoke' });
  tempTables.push(path.dirname(second.workDir));
  firstWindow.destroy();
  for (let i = 0; i < 2; i++) {
    const result = await a.callTool({
      name: 'vpx_material',
      arguments: { action: 'add', material: { name: 'WrongTable' }, confirm: true },
    });
    assert(result.isError);
  }
  const otherMats = await call(b, 'vpx_material', { action: 'list' });
  assert(!otherMats.materials.some(m => m.name === 'WrongTable'));
  console.log('SMOKE PASS closed session remains detached');
  for (const w of BrowserWindow.getAllWindows())
    assert.equal(await w.webContents.executeJavaScript('document.body.inert'), false);
  console.log('SMOKE PASS editor input restored');
  console.log('SMOKE ALL PASSED');
  await finish(0);
})().catch(async err => {
  console.error('SMOKE FAIL', err.stack);
  await finish(1);
});
