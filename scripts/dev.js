#!/usr/bin/env node
/**
 * Custom dev script that replicates `n8n-node dev` but pins a specific n8n
 * version instead of using `n8n@latest`. This prevents broken n8n releases
 * from breaking the local dev workflow.
 *
 * To upgrade the dev n8n version, update N8N_VERSION below.
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const N8N_VERSION = '2.15.1';

// Parse --custom-user-folder flag
const args = process.argv.slice(2);
const folderFlagIdx = args.indexOf('--custom-user-folder');
const n8nUserFolder =
  folderFlagIdx !== -1
    ? args[folderFlagIdx + 1]
    : path.join(os.homedir(), '.n8n-node-cli');

// Read package name for the symlink
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageName = pkg.name;

// Set up the custom nodes folder n8n picks up automatically
const nodeModulesFolder = path.join(n8nUserFolder, '.n8n', 'custom', 'node_modules');
fs.mkdirSync(nodeModulesFolder, { recursive: true });

const symlinkPath = path.join(nodeModulesFolder, packageName);
try {
  // Ensure the symlink's parent directory exists. Required for scoped
  // packages (e.g. @getpopapi/...) where the scope folder is created lazily.
  fs.mkdirSync(path.dirname(symlinkPath), { recursive: true });
  if (fs.existsSync(symlinkPath)) fs.rmSync(symlinkPath, { recursive: true });
  fs.symlinkSync(process.cwd(), symlinkPath);
} catch (e) {
  console.error('Failed to create symlink:', e.message);
  process.exit(1);
}

console.log(`n8n-node dev (pinned n8n@${N8N_VERSION})`);
console.log(`User folder: ${n8nUserFolder}\n`);

const tsc = spawn('npx', ['tsc', '--watch', '--pretty'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const n8n = spawn('npx', ['-y', `n8n@${N8N_VERSION}`], {
  cwd: n8nUserFolder,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    N8N_DEV_RELOAD: 'true',
    DB_SQLITE_POOL_SIZE: '10',
    N8N_USER_FOLDER: n8nUserFolder,
  },
});

const cleanup = () => {
  try { tsc.kill(); } catch {}
  try { n8n.kill(); } catch {}
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

n8n.on('exit', (code) => {
  cleanup();
  process.exit(code ?? 1);
});

tsc.on('exit', (code) => {
  if (code !== null && code !== 0) {
    cleanup();
    process.exit(code);
  }
});
