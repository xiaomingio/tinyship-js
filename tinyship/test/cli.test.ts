/**
 * 文件说明: 验证 TinyShip CLI 的命令层级，确保 deploy host 名称不会和顶层命令冲突。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { main } from '../dist/deploy.js';

test('deploy help exits before loading project config', async () => {
  await assert.doesNotReject(() => main(['deploy', '--help'], '/tmp/tinyship-missing-project'));
});

test('validate static deploy config does not require ecosystem file', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tinyship-static-cli-'));
  fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'tinyship.config.yml'), [
    'hosts:',
    '  static:',
    '    ssh:',
    '      target: root@example.com',
    '    appDir: /var/www/static',
    '    rsync:',
    '      - dist/',
    'services:',
    '  static:',
    '    host: static',
    '    npmInstall: false',
    '    pm2Restart: false',
    '    postCommand: []',
  ].join('\n'));

  const originalInfo = console.info;
  console.info = () => {};
  try {
    await assert.doesNotReject(() => main(['validate'], rootDir));
  } finally {
    console.info = originalInfo;
  }
});

test('deploy command requires explicit host or service scope', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tinyship-cli-scope-'));
  fs.writeFileSync(path.join(rootDir, 'tinyship.config.yml'), 'hosts: {}\nservices: {}\n');

  const originalError = console.error;
  const originalExit = process.exit;
  const errors: string[] = [];
  console.error = (message?: unknown) => {
    errors.push(String(message));
  };
  process.exit = ((code?: string | number | null) => {
    throw new Error(`exit ${code}`);
  }) as typeof process.exit;

  try {
    await assert.rejects(() => main(['deploy', 'web'], rootDir), /exit 1/);
  } finally {
    console.error = originalError;
    process.exit = originalExit;
  }

  assert.ok(errors.some(line => line.includes('tinyship deploy host <hostName>')));
});
