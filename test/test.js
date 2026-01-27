const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'src', 'index.js');
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lobstash-test-'));

let passed = 0;
let failed = 0;

function run(args) {
  try {
    return execSync(`node ${CLI} ${args}`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1' },
    }).trim();
  } catch (err) {
    return { error: true, stderr: err.stderr?.trim() || '', stdout: err.stdout?.trim() || '', status: err.status };
  }
}

function assert(description, condition) {
  if (condition) {
    console.log(`  PASS: ${description}`);
    passed++;
  } else {
    console.log(`  FAIL: ${description}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n${name}`);
  console.log('-'.repeat(name.length));
}

// Setup: Create test .env files
fs.writeFileSync(path.join(TEST_DIR, '.env'), [
  'DB_HOST=localhost',
  'DB_PORT=5432',
  'DB_NAME=myapp_dev',
  'SECRET_KEY=dev-secret-123',
  'DEBUG=true',
].join('\n') + '\n');

// --- Tests ---

section('Save command');
{
  const out = run('save dev');
  assert('saves .env as "dev"', typeof out === 'string' && out.includes('dev'));
  assert('reports variable count', typeof out === 'string' && out.includes('5 variables'));
}

section('Save duplicate without --force');
{
  const out = run('save dev');
  assert('rejects duplicate stash', out.error === true);
}

section('Save with --force');
{
  const out = run('save dev --force');
  assert('overwrites with --force', typeof out === 'string' && out.includes('dev'));
}

section('List command');
{
  const out = run('list');
  assert('lists stashes', typeof out === 'string' && out.includes('dev'));
  assert('shows var count', typeof out === 'string' && out.includes('5 vars'));
  assert('shows total count', typeof out === 'string' && out.includes('1 stash total'));
}

section('Show command');
{
  const out = run('show dev');
  assert('shows stash contents', typeof out === 'string' && out.includes('DB_HOST'));
  assert('shows values', typeof out === 'string' && out.includes('localhost'));
  assert('shows variable count', typeof out === 'string' && out.includes('5 variables'));
}

section('Show with --no-values');
{
  const out = run('show dev --no-values');
  assert('shows keys', typeof out === 'string' && out.includes('DB_HOST'));
  assert('hides values', typeof out === 'string' && !out.includes('localhost'));
}

section('Save a second stash');
{
  // Create a different .env
  fs.writeFileSync(path.join(TEST_DIR, '.env'), [
    'DB_HOST=prod-db.example.com',
    'DB_PORT=5432',
    'DB_NAME=myapp_prod',
    'SECRET_KEY=prod-secret-456',
    'DEBUG=false',
    'REDIS_URL=redis://cache.example.com',
  ].join('\n') + '\n');

  const out = run('save prod');
  assert('saves second stash', typeof out === 'string' && out.includes('prod'));
  assert('reports 6 variables', typeof out === 'string' && out.includes('6 variables'));
}

section('List multiple stashes');
{
  const out = run('list');
  assert('lists both stashes', typeof out === 'string' && out.includes('dev') && out.includes('prod'));
  assert('shows 2 stashes total', typeof out === 'string' && out.includes('2 stashes total'));
}

section('Diff command');
{
  const out = run('diff dev prod');
  assert('shows diff output', typeof out === 'string');
  assert('detects added var', typeof out === 'string' && out.includes('REDIS_URL'));
  assert('detects changed var', typeof out === 'string' && out.includes('DB_HOST'));
  assert('shows changed values', typeof out === 'string' && out.includes('localhost'));
}

section('Diff-env command');
{
  const out = run('diff-env dev');
  assert('compares stash to current .env', typeof out === 'string');
  assert('shows differences', typeof out === 'string' && out.includes('DB_HOST'));
}

section('Load command');
{
  const out = run('load dev');
  assert('loads stash', typeof out === 'string' && out.includes('Loaded'));

  const loaded = fs.readFileSync(path.join(TEST_DIR, '.env'), 'utf-8');
  assert('restores correct content', loaded.includes('DB_HOST=localhost'));
  assert('does not contain prod vars', !loaded.includes('REDIS_URL'));
}

section('Load with --merge');
{
  // First set up a base .env with a unique var
  fs.writeFileSync(path.join(TEST_DIR, '.env'), [
    'EXISTING_VAR=keep_me',
    'DB_HOST=old-host',
  ].join('\n') + '\n');

  const out = run('load dev --merge');
  assert('merges stash', typeof out === 'string' && out.includes('Merged'));

  const merged = fs.readFileSync(path.join(TEST_DIR, '.env'), 'utf-8');
  assert('keeps existing vars', merged.includes('EXISTING_VAR=keep_me'));
  assert('overwrites conflicting vars', merged.includes('DB_HOST=localhost'));
}

section('Remove command');
{
  const out = run('rm dev');
  assert('removes stash', typeof out === 'string' && out.includes('Removed'));

  const list = run('list');
  assert('stash no longer listed', typeof list === 'string' && !list.includes('dev'));
  assert('other stash still exists', typeof list === 'string' && list.includes('prod'));
}

section('Error handling');
{
  const showMissing = run('show nonexistent');
  assert('show missing stash fails', showMissing.error === true);

  const loadMissing = run('load nonexistent');
  assert('load missing stash fails', loadMissing.error === true);

  const rmMissing = run('rm nonexistent');
  assert('rm missing stash fails', rmMissing.error === true);

  // Test save with no .env
  const noEnvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lobstash-noenv-'));
  try {
    execSync(`node ${CLI} save test`, { cwd: noEnvDir, encoding: 'utf-8' });
    assert('save with no .env fails', false);
  } catch (err) {
    assert('save with no .env fails', err.status !== 0);
  }
}

section('Custom file option');
{
  fs.writeFileSync(path.join(TEST_DIR, '.env.local'), [
    'LOCAL_VAR=hello',
    'LOCAL_SECRET=world',
  ].join('\n') + '\n');

  const out = run('save local-config -f .env.local');
  assert('saves custom file', typeof out === 'string' && out.includes('local-config'));
  assert('reports 2 variables', typeof out === 'string' && out.includes('2 variables'));

  const show = run('show local-config');
  assert('shows custom file stash', typeof show === 'string' && show.includes('LOCAL_VAR'));
}

section('Version and help');
{
  const ver = run('--version');
  assert('shows version', typeof ver === 'string' && ver.includes('1.0.0'));

  const help = run('--help');
  assert('shows help', typeof help === 'string' && help.includes('lobstash'));
}

// Cleanup
fs.rmSync(TEST_DIR, { recursive: true, force: true });

// Results
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

process.exit(failed > 0 ? 1 : 0);
