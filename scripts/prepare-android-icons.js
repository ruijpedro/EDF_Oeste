
import fs from 'fs';
import path from 'path';

const iconFiles = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
];

function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }

const source192 = path.join('public', 'icon-192.png');
const source512 = path.join('public', 'icon-512.png');

if (!fs.existsSync(source192) && !fs.existsSync(source512)) {
  console.log('No PNG icon found in public/. Skipping icon copy.');
  process.exit(0);
}

const src = fs.existsSync(source192) ? source192 : source512;

for (const [folder] of iconFiles) {
  const outDir = path.join('android','app','src','main','res',folder);
  ensureDir(outDir);
  fs.copyFileSync(src, path.join(outDir, 'ic_launcher.png'));
  fs.copyFileSync(src, path.join(outDir, 'ic_launcher_round.png'));
}

const manifestPath = path.join('android','app','src','main','AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let xml = fs.readFileSync(manifestPath, 'utf8');
  xml = xml.replace(/android:label="[^"]*"/, 'android:label="EDF_Oeste"');
  if (!xml.includes('android:icon="@mipmap/ic_launcher"')) {
    xml = xml.replace('<application', '<application\n        android:icon="@mipmap/ic_launcher"\n        android:roundIcon="@mipmap/ic_launcher_round"');
  }
  fs.writeFileSync(manifestPath, xml);
}

console.log('Android icons prepared.');
