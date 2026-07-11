/**
 * 文件说明: 验证 TinyShip 单台 host 发布步骤的显式顺序。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeployPlan, createDeploySteps } from '../dist/deploy.js';
import { exampleDeployConfig, exampleEcosystemConfig } from './fixtures.ts';

test('deploy steps describe the host deployment sequence', () => {
  const deployConfig = exampleDeployConfig();
  const ecosystemConfig = exampleEcosystemConfig();
  const plan = createDeployPlan({ hostName: 'web', ecosystemConfig, deployConfig });

  assert.deepEqual(
    createDeploySteps({ plan, deployConfig, ecosystemConfig, rootDir: process.cwd() }).map(step => step.name),
    [
      'validate env files',
      'validate rsync files',
      'prepare remote directories',
      'rsync deploy paths',
      'npm install',
      'pm2 restart',
    ],
  );
});

test('deploy steps use the injected runner for remote commands', async () => {
  const deployConfig = exampleDeployConfig();
  const ecosystemConfig = exampleEcosystemConfig();
  const plan = createDeployPlan({ hostName: 'web', ecosystemConfig, deployConfig });
  const commands: Array<[string, string[]]> = [];
  const steps = createDeploySteps({
    plan,
    deployConfig,
    ecosystemConfig,
    rootDir: process.cwd(),
    runner: async (command, args) => {
      commands.push([command, args]);
    },
  });

  await steps[2].run();
  await steps[3].run();
  await steps[4].run();
  await steps[5].run();

  assert.ok(commands.some(([command]) => command === 'ssh'));
  assert.ok(commands.some(([command]) => command === 'rsync'));
  assert.equal(commands.filter(([command]) => command === 'rsync').length, 1);
  assert.ok(commands.some(([command, args]) => command === 'rsync' && args.includes('--relative')));
  assert.ok(commands.some(([command, args]) => command === 'ssh' && args.includes('/var/www/example')));
  assert.equal(commands.some(([command, args]) => command === 'ssh' && args.includes('/var/www/example/dist')), false);
  assert.ok(commands.some(([, args]) => args.some(arg => arg.includes('pm2 startOrReload'))));
});

test('deploy steps run post commands after enabled built-in actions', async () => {
  const deployConfig = exampleDeployConfig({ postCommand: ['systemctl reload nginx'] });
  const ecosystemConfig = exampleEcosystemConfig();
  const plan = createDeployPlan({ hostName: 'web', ecosystemConfig, deployConfig });
  const commands: Array<[string, string[]]> = [];
  const steps = createDeploySteps({
    plan,
    deployConfig,
    ecosystemConfig,
    rootDir: process.cwd(),
    runner: async (command, args) => {
      commands.push([command, args]);
    },
  });

  assert.deepEqual(steps.map(step => step.name), [
    'validate env files',
    'validate rsync files',
    'prepare remote directories',
    'rsync deploy paths',
    'npm install',
    'pm2 restart',
    'post command',
  ]);

  await steps[6].run();

  assert.ok(commands.some(([, args]) => args.some(arg => arg.includes('systemctl reload nginx'))));
});

test('deploy steps for static hosts only prepare and rsync files', () => {
  const deployConfig = exampleDeployConfig({
    npmInstall: false,
    pm2Restart: false,
    rsync: ['dist/'],
  });
  const plan = createDeployPlan({ hostName: 'web', deployConfig });

  assert.deepEqual(
    createDeploySteps({ plan, deployConfig, rootDir: process.cwd() }).map(step => step.name),
    ['validate rsync files', 'prepare remote directories', 'rsync deploy paths'],
  );
});

test('deploy steps run npm install once for multiple selected services on one host', async () => {
  const deployConfig = {
    hosts: {
      web: {
        ssh: { target: 'root@example.com' },
        appDir: '/var/www/example',
        rsync: ['dist/', 'package.json', 'ecosystem.config.cjs', '.env.production', '.env.production'],
      },
    },
    services: {
      'example-server': { host: 'web', npmInstall: true, pm2Restart: true, postCommand: [] },
      'example-worker': { host: 'web', npmInstall: true, pm2Restart: true, postCommand: [] },
    },
  };
  const ecosystemConfig = {
    apps: [
      { name: 'example-server', script: 'dist/src/server.js', env: { NODE_ENV: 'production' } },
      { name: 'example-worker', script: 'dist/src/worker.js', env: { NODE_ENV: 'production' } },
    ],
  };
  const plan = createDeployPlan({ hostName: 'web', ecosystemConfig, deployConfig });
  const commands: Array<[string, string[]]> = [];
  const steps = createDeploySteps({
    plan,
    deployConfig,
    ecosystemConfig,
    rootDir: process.cwd(),
    runner: async (command, args) => {
      commands.push([command, args]);
    },
  });

  await steps.find(step => step.name === 'npm install')?.run();
  await steps.find(step => step.name === 'pm2 restart')?.run();

  assert.equal(commands.filter(([, args]) => args.some(arg => arg.includes('npm install --omit=dev'))).length, 1);
  assert.equal(commands.filter(([, args]) => args.some(arg => arg.includes('pm2 startOrReload'))).length, 1);
  assert.ok(commands.some(([, args]) => args.some(arg => arg.includes('--only "example-server"'))));
  assert.ok(commands.some(([, args]) => args.some(arg => arg.includes('--only "example-worker"'))));
});
