// Script to copy Bob artifacts into extension for bundling
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'bob_artifacts');
const targetDir = path.join(__dirname, 'bob_artifacts');

// Create target directory structure
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Copy file
function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${path.relative(__dirname, dest)}`);
}

// Main copy logic
function copyArtifacts() {
  console.log('Copying Bob artifacts into extension...\n');

  const files = [
    'custom_modes.yaml',
    'modes/auditor.md',
    'skills/claim-taxonomy.md',
    'skills/claim-verification.md',
    'commands/audit.md',
    'commands/fix-claim.md',
    'commands/fix-all.md'
  ];

  for (const file of files) {
    const src = path.join(sourceDir, file);
    const dest = path.join(targetDir, file);
    
    if (fs.existsSync(src)) {
      copyFile(src, dest);
    } else {
      console.warn(`Warning: Source file not found: ${src}`);
    }
  }

  console.log('\n✓ Bob artifacts copied successfully');
}

// Run
try {
  copyArtifacts();
} catch (error) {
  console.error('Error copying artifacts:', error);
  process.exit(1);
}

// Made with Bob
