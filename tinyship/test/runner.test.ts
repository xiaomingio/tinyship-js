/**
 * 文件说明: 验证 TinyShip dry-run 复用真实 deploy steps，但只打印命令不执行远程操作。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { dryRunHost, dryRunService } from '../dist/deploy.js';
import { exampleDeployConfig, exampleEcosystemConfig } from './fixtures.ts';

test('dry-run host prints the same deploy commands without executing them', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tinyship-dry-run-'));
  fs.mkdirSync(path.join(rootDir, 'dist/src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'dist/src/server.js'), '');
  fs.writeFileSync(path.join(rootDir, 'package.json'), '{}');
  fs.writeFileSync(path.join(rootDir, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(rootDir, 'ecosystem.config.cjs'), 'module.exports = { apps: [] };');
  fs.writeFileSync(path.join(rootDir, 'tinyship.config.yml'), '');
  fs.writeFileSync(path.join(rootDir, '.env.production'), '');

  const logs: string[] = [];
  const originalInfo = console.info;
  console.info = (message?: unknown) => {
    logs.push(String(message));
  };

  try {
    await dryRunHost({
      hostName: 'web',
      deployConfig: exampleDeployConfig(),
      ecosystemConfig: exampleEcosystemConfig(),
      rootDir,
    });
  } finally {
    console.info = originalInfo;
  }

  assert.ok(logs.some(line => line.includes('# Dry run host web to root@example.com:/var/www/example')));
  assert.equal(logs[0], '');
  assert.ok(logs.some(line => line.startsWith('# [1/6] validate env files')));
  assert.ok(logs.some((line, index) => line.startsWith('# [3/6] prepare remote directories') && logs[index - 1] === ''));
  assert.ok(logs.some(line => line.startsWith('ssh root@example.com mkdir -p')));
  assert.equal(logs.filter(line => line.includes('rsync -az --delete')).length, 1);
  assert.ok(logs.some(line => line.startsWith('rsync -az --delete --relative')));
  assert.ok(logs.some(line => line.includes('dist package.json package-lock.json ecosystem.config.cjs')));
  assert.ok(logs.some(line => line.includes('.env.production')));
  assert.ok(logs.some(line => line.includes('root@example.com:/var/www/example/')));
  assert.ok(logs.some(line => line.includes('pm2 startOrReload')));
  assert.ok(logs.some(line => line.includes('# Dry run complete.')));
});

test('dry-run service rsyncs the host and restarts only the selected service', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tinyship-dry-run-service-'));
  fs.mkdirSync(path.join(rootDir, 'dist/src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'dist/src/server.js'), '');
  fs.writeFileSync(path.join(rootDir, 'dist/src/worker.js'), '');
  fs.writeFileSync(path.join(rootDir, 'package.json'), '{}');
  fs.writeFileSync(path.join(rootDir, 'ecosystem.config.cjs'), 'module.exports = { apps: [] };');
  fs.writeFileSync(path.join(rootDir, '.env.production'), '');
  fs.writeFileSync(path.join(rootDir, '.env.production'), '');

  const deployConfig = {
    hosts: {
      web: {
        ssh: { target: 'root@example.com' },
        appDir: '/var/www/example',
        rsync: ['dist/', 'package.json', 'ecosystem.config.cjs', '.env.production', '.env.production'],
      },
    },
    services: {
      'example-server': { host: 'web', npmInstall: true, pm2Restart: true, postCommand: ['printf server'] },
      'example-worker': { host: 'web', npmInstall: true, pm2Restart: true, postCommand: ['printf worker'] },
    },
  };
  const ecosystemConfig = {
    apps: [
      { name: 'example-server', script: 'dist/src/server.js', env: { NODE_ENV: 'production' } },
      { name: 'example-worker', script: 'dist/src/worker.js', env: { NODE_ENV: 'production' } },
    ],
  };
  const logs: string[] = [];
  const originalInfo = console.info;
  console.info = (message?: unknown) => {
    logs.push(String(message));
  };

  try {
    await dryRunService({
      serviceName: 'example-server',
      deployConfig,
      ecosystemConfig,
      rootDir,
    });
  } finally {
    console.info = originalInfo;
  }

  assert.ok(logs.some(line => line.includes('# Dry run service example-server to root@example.com:/var/www/example')));
  assert.equal(logs.filter(line => line.includes('rsync -az --delete')).length, 1);
  assert.ok(logs.some(line => line.includes('--only "example-server"')));
  assert.equal(logs.some(line => line.includes('--only "example-worker"')), false);
  assert.ok(logs.some(line => line.includes('printf server')));
  assert.equal(logs.some(line => line.includes('printf worker')), false);
});

test('dry-run uses the same validation core as validate', async () => {
  await assert.rejects(
    () =>
      dryRunHost({
        hostName: 'web',
        deployConfig: exampleDeployConfig(),
        ecosystemConfig: exampleEcosystemConfig(),
        rootDir: process.cwd(),
      }),
    /TinyShip validation failed/,
  );
});
