const fs = require('fs');
const path = require('path');

function parseEnvString(content) {
  const vars = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function readEnvFile(dir, filename) {
  const envPath = path.join(dir, filename || '.env');
  if (!fs.existsSync(envPath)) {
    return null;
  }
  return fs.readFileSync(envPath, 'utf-8');
}

function writeEnvFile(dir, content, filename) {
  const envPath = path.join(dir, filename || '.env');
  fs.writeFileSync(envPath, content);
}

function diffEnvs(contentA, contentB) {
  const varsA = parseEnvString(contentA);
  const varsB = parseEnvString(contentB);
  const allKeys = new Set([...Object.keys(varsA), ...Object.keys(varsB)]);
  const added = [];
  const removed = [];
  const changed = [];
  const same = [];

  for (const key of [...allKeys].sort()) {
    const inA = key in varsA;
    const inB = key in varsB;
    if (inA && !inB) {
      removed.push({ key, value: varsA[key] });
    } else if (!inA && inB) {
      added.push({ key, value: varsB[key] });
    } else if (varsA[key] !== varsB[key]) {
      changed.push({ key, oldValue: varsA[key], newValue: varsB[key] });
    } else {
      same.push({ key, value: varsA[key] });
    }
  }

  return { added, removed, changed, same };
}

module.exports = {
  parseEnvString,
  readEnvFile,
  writeEnvFile,
  diffEnvs,
};
