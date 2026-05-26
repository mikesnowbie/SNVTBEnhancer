const fs = require('fs');
const isMinor = process.argv.includes('--minor');

function bumpManifest(path) {
  const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
  const parts = manifest.version.split('.').map(Number);
  if (isMinor) {
    parts[1]++;
    parts[2] = 0;
  } else {
    parts[2]++;
  }
  manifest.version = parts.join('.');
  fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  return manifest.version;
}

try {
  const version = bumpManifest('manifest.json');
  bumpManifest('safari-extension/manifest.json');
  console.log(`Version bumped to ${version}`);
} catch (error) {
  console.error('Error bumping version:', error);
  process.exit(1);
}
