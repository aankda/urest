import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distRoot = path.resolve('dist');
const packageDir = path.join(distRoot, 'packages');

// Ensure packages directory exists
if (!fs.existsSync(packageDir)) {
  fs.mkdirSync(packageDir, { recursive: true });
}

const getVersion = () => {
  const manifestPath = path.resolve('public/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.version;
};

const version = getVersion();
const targets = ['firefox', 'edge'];

console.log(`📦 Starting packaging for version ${version}...`);

targets.forEach(target => {
  const targetDir = path.join(distRoot, target);
  if (!fs.existsSync(targetDir)) {
    console.warn(`⚠️  Target directory ${targetDir} not found. Skipping.`);
    return;
  }

  const zipName = `Urest-${target === 'firefox' ? 'Firefox' : 'Edge'}-v${version}.zip`;
  const zipPath = path.join(packageDir, zipName);

  console.log(`🚀 Packaging ${target}...`);
  
  try {
    // Remove existing zip if it exists
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // Use system zip command
    execSync(`cd "${targetDir}" && zip -r -X "${zipPath}" . -x "*.DS_Store*" -x "__MACOSX*" -x "*.map"`);
    
    console.log(`✅ Created ${zipName}`);
  } catch (error) {
    console.error(`❌ Failed to package ${target}:`, error.message);
  }
});

console.log('✨ Packaging complete! Artifacts located in dist/packages/');
