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
      'install dependencies and reload PM2',
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

  assert.ok(commands.some(([command]) => command === 'ssh'));
  assert.ok(commands.some(([command]) => command === 'rsync'));
  assert.equal(commands.filter(([command]) => command === 'rsync').length, 1);
  assert.ok(commands.some(([command, args]) => command === 'rsync' && args.includes('--relative')));
  assert.ok(commands.some(([command, args]) => command === 'ssh' && args.includes('/var/www/example')));
  assert.equal(commands.some(([command, args]) => command === 'ssh' && args.includes('/var/www/example/dist')), false);
  assert.ok(commands.some(([, args]) => args.some(arg => arg.includes('pm2 startOrReload'))));
});
