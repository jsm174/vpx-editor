import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'resources', 'vendor.json'), 'utf-8'));
const checkOnly = process.argv.includes('--check');

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

let fetched = 0;
let verified = 0;
const failures = [];
const tarballs = new Map();

async function repoTarball(source) {
  const key = `${source.repo}@${source.commit}`;
  if (!tarballs.has(key)) {
    console.log(`vendor: downloading ${source.repo}@${source.commit.slice(0, 12)} (large, one-time)…`);
    tarballs.set(key, await download(`https://codeload.github.com/${source.repo}/tar.gz/${source.commit}`));
  }
  return tarballs.get(key);
}

async function assembleVpxSource(source) {
  const spec = source.assembleVpx;
  const outPath = join(root, source.dest, spec.output);
  const stampPath = `${outPath}.commit`;
  if (existsSync(outPath) && existsSync(stampPath) && readFileSync(stampPath, 'utf-8').trim() === source.commit) {
    verified++;
    return;
  }
  if (checkOnly) {
    failures.push(`${source.dest}/${spec.output}: missing or built from a different commit`);
    return;
  }
  const tmp = mkdtempSync(join(tmpdir(), 'vendor-vpx-'));
  try {
    const tarPath = join(tmp, 'repo.tgz');
    writeFileSync(tarPath, await repoTarball(source));
    const repoName = source.repo.split('/')[1];
    execFileSync('tar', ['-xzf', 'repo.tgz', '--strip-components=1', `${repoName}-${source.commit}/${spec.subdir}`], {
      cwd: tmp,
    });
    const treeRoot = join(tmp, spec.subdir);

    const files = {};
    const walk = d => {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else files['/vpx/' + relative(treeRoot, p).replaceAll('\\', '/')] = readFileSync(p);
      }
    };
    walk(treeRoot);

    console.log(`vendor: assembling ${spec.output} from ${Object.keys(files).length} files…`);
    const wasmDir = join(root, 'node_modules', '@francisdb', 'vpin-wasm');
    const { initSync, assemble } = await import(pathToFileURL(join(wasmDir, 'vpin.js')).href);
    initSync({ module: new WebAssembly.Module(readFileSync(join(wasmDir, 'vpin_bg.wasm'))) });
    const bytes = assemble(files, null);

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, bytes);
    writeFileSync(stampPath, source.commit + '\n');
    fetched++;
  } catch (err) {
    failures.push(`${source.dest}/${spec.output}: ${err.message}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

for (const source of manifest.sources) {
  if (source.assembleVpx) {
    await assembleVpxSource(source);
    continue;
  }
  for (const file of source.files) {
    const dest = join(root, source.dest, file.path);
    if (existsSync(dest) && sha256(readFileSync(dest)) === file.sha256) {
      verified++;
      continue;
    }
    if (checkOnly) {
      failures.push(`${source.dest}/${file.path}: missing or modified`);
      continue;
    }
    const url = `https://raw.githubusercontent.com/${source.repo}/${source.commit}/${file.from}`;
    try {
      const bytes = await download(url);
      const actual = sha256(bytes);
      if (actual !== file.sha256) {
        failures.push(`${source.dest}/${file.path}: sha256 ${actual} does not match manifest ${file.sha256}`);
        continue;
      }
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, bytes);
      fetched++;
    } catch (err) {
      failures.push(`${source.dest}/${file.path}: ${err.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`vendor: ${failures.length} problem(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`vendor: ${verified} up to date, ${fetched} fetched`);
