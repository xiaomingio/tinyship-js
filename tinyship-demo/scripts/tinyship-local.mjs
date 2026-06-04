#!/usr/bin/env node
/**
 * 文件说明: 通过 node_modules bin 链接管理 tinyship-demo 使用的 TinyShip 来源。
 */
import { lstat, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const demoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tinyshipBinPath = path.join(demoDir, 'node_modules/.bin/tinyship');
const localTinyshipBin = path.resolve(demoDir, '../tinyship/bin/tinyship.mjs');
const installedTinyshipBin = '../@xiaomingio/tinyship/bin/tinyship.mjs';
const command = process.argv[2];

async function ensureInstalledTinyshipBin() {
  try {
    await lstat(tinyshipBinPath);
  } catch {
    throw new Error('tinyship-demo/node_modules/.bin/tinyship is missing. Run npm install in tinyship-demo first.');
  }
}

async function replaceTinyshipBin(target) {
  await rm(tinyshipBinPath, { force: true });
  await symlink(target, tinyshipBinPath);
}

if (command === 'on') {
  await ensureInstalledTinyshipBin();
  await replaceTinyshipBin(localTinyshipBin);
  console.info('tinyship-demo now uses the local ../tinyship package.');
} else if (command === 'off') {
  await ensureInstalledTinyshipBin();
  await replaceTinyshipBin(installedTinyshipBin);
  console.info('tinyship-demo now uses the installed @xiaomingio/tinyship package.');
} else {
  console.error('Usage: node scripts/tinyship-local.mjs on|off');
  process.exit(1);
}
