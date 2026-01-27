const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_DIR = path.join(os.homedir(), '.lobstash');

function ensureStoreDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function getProjectId(dir) {
  return Buffer.from(dir).toString('base64url');
}

function getProjectDir(dir) {
  const projDir = path.join(STORE_DIR, getProjectId(dir));
  if (!fs.existsSync(projDir)) {
    fs.mkdirSync(projDir, { recursive: true });
  }
  return projDir;
}

function getStashPath(dir, name) {
  return path.join(getProjectDir(dir), `${name}.env`);
}

function getMetaPath(dir) {
  return path.join(getProjectDir(dir), '_meta.json');
}

function readMeta(dir) {
  const metaPath = getMetaPath(dir);
  if (fs.existsSync(metaPath)) {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  }
  return { projectPath: dir, stashes: {} };
}

function writeMeta(dir, meta) {
  fs.writeFileSync(getMetaPath(dir), JSON.stringify(meta, null, 2));
}

function saveStash(dir, name, content) {
  ensureStoreDir();
  const stashPath = getStashPath(dir, name);
  fs.writeFileSync(stashPath, content);

  const meta = readMeta(dir);
  meta.stashes[name] = {
    savedAt: new Date().toISOString(),
    varCount: content.split('\n').filter(l => l.trim() && !l.startsWith('#')).length,
  };
  writeMeta(dir, meta);
}

function loadStash(dir, name) {
  const stashPath = getStashPath(dir, name);
  if (!fs.existsSync(stashPath)) {
    return null;
  }
  return fs.readFileSync(stashPath, 'utf-8');
}

function listStashes(dir) {
  ensureStoreDir();
  const meta = readMeta(dir);
  return meta.stashes;
}

function removeStash(dir, name) {
  const stashPath = getStashPath(dir, name);
  if (!fs.existsSync(stashPath)) {
    return false;
  }
  fs.unlinkSync(stashPath);

  const meta = readMeta(dir);
  delete meta.stashes[name];
  writeMeta(dir, meta);
  return true;
}

function stashExists(dir, name) {
  return fs.existsSync(getStashPath(dir, name));
}

module.exports = {
  STORE_DIR,
  ensureStoreDir,
  saveStash,
  loadStash,
  listStashes,
  removeStash,
  stashExists,
};
