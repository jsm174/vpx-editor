const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION = 'v0.24.9';
const BASE_URL = `https://github.com/francisdb/vpxtool/releases/download/${VERSION}`;

const PLATFORM_MAP = {
  darwin: 'macOS',
  linux: 'Linux',
  win32: 'Windows',
};

const ARCH_MAP = {
  x64: 'x86_64',
  arm64: 'aarch64',
};

function getDownloadUrl() {
  const platform = PLATFORM_MAP[process.platform];
  const arch = ARCH_MAP[process.arch];

  if (!platform || !arch) {
    throw new Error(`Unsupported platform: ${process.platform}-${process.arch}`);
  }

  const suffix = process.platform === 'linux' ? '-musl' : '';
  const ext = process.platform === 'win32' ? 'zip' : 'tar.gz';

  return `${BASE_URL}/vpxtool-${platform}-${arch}${suffix}-${VERSION}.${ext}`;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

function extract(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });

  if (archivePath.endsWith('.zip')) {
    if (process.platform === 'win32') {
      execSync(`powershell -Command "Expand-Archive -Force '${archivePath}' '${destDir}'"`, { stdio: 'inherit' });
    } else {
      execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
    }
  } else {
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  }
}

async function main() {
  const resourcesDir = path.join(__dirname, '..', 'resources', 'vpxtool');
  const binaryName = process.platform === 'win32' ? 'vpxtool.exe' : 'vpxtool';
  const binaryPath = path.join(resourcesDir, binaryName);
  const versionFile = path.join(resourcesDir, '.version');

  if (fs.existsSync(binaryPath) && fs.existsSync(versionFile)) {
    const installedVersion = fs.readFileSync(versionFile, 'utf8').trim();
    if (installedVersion === VERSION) {
      console.log(`vpxtool ${VERSION} already installed`);
      return;
    }
  }

  const url = getDownloadUrl();
  const ext = process.platform === 'win32' ? 'zip' : 'tar.gz';
  const archivePath = path.join(__dirname, `vpxtool.${ext}`);

  console.log(`Downloading vpxtool ${VERSION} for ${process.platform}-${process.arch}...`);
  console.log(`URL: ${url}`);

  await download(url, archivePath);

  console.log('Extracting...');
  extract(archivePath, resourcesDir);

  fs.unlinkSync(archivePath);

  if (process.platform !== 'win32') {
    fs.chmodSync(binaryPath, 0o755);
  }

  fs.writeFileSync(versionFile, VERSION);

  console.log(`vpxtool ${VERSION} installed to ${resourcesDir}`);
}

main().catch((err) => {
  console.error('Failed to download vpxtool:', err.message);
  process.exit(1);
});
