/**
 * 文件说明: 验证 TinyShip 部署计划的通用推导与配置校验规则。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeployPlan, validateDeployConfig } from '../dist/deploy.js';
import { exampleDeployConfig, exampleEcosystemConfig, requiredRsync } from './fixtures.ts';

test('deploy plan derives prod env files from service ids', () => {
  const plan = createDeployPlan({
    hostName: 'web',
    ecosystemConfig: {
      apps: [
        {
          name: 'example-server',
          script: 'dist/src/server.js',
          env: { NODE_ENV: 'prod.example-server' },
        },
        {
          name: 'example-worker',
          script: 'dist/src/worker.js',
          env: { NODE_ENV: 'prod.example-worker' },
        },
      ],
    },
    deployConfig: {
      hosts: {
        web: {
          ssh: { target: 'root@example.com' },
          appDir: '/var/www/example',
          rsync: [...requiredRsync, '.env.prod.example-server', '.env.prod.example-worker'],
        },
      },
      services: {
        'example-server': { host: 'web' },
        'example-worker': { host: 'web' },
      },
    },
  });

  assert.deepEqual(plan.envFiles, ['.env.prod.example-server', '.env.prod.example-worker']);
  assert.deepEqual(plan.services.map(service => service.nodeEnv), ['prod.example-server', 'prod.example-worker']);
  assert.deepEqual(plan.host.ssh, { target: 'root@example.com' });
});

test('deploy validation requires NODE_ENV to match prod service id', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        ecosystemConfig: exampleEcosystemConfig({ nodeEnv: 'production-server' }),
        deployConfig: exampleDeployConfig(),
      }),
    /prod\.example-server/,
  );
});

test('deploy validation accepts split ssh user and host', () => {
  assert.doesNotThrow(() =>
    validateDeployConfig({
      ecosystemConfig: exampleEcosystemConfig(),
      deployConfig: exampleDeployConfig({
        ssh: { user: 'deploy', host: '203.0.113.10', port: 2222 },
      }),
    }),
  );
});

test('deploy validation requires baseline rsync paths', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        ecosystemConfig: exampleEcosystemConfig(),
        deployConfig: exampleDeployConfig({
          rsync: ['dist/', 'package.json', 'package-lock.json', 'ecosystem.config.cjs', '.env.prod.example-server'],
        }),
      }),
    /tinyship\.config\.yml/,
  );
});

test('deploy validation requires env files to be listed in rsync', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        ecosystemConfig: exampleEcosystemConfig(),
        deployConfig: exampleDeployConfig({ rsync: requiredRsync }),
      }),
    /\.env\.prod\.example-server/,
  );
});

test('deploy validation requires PM2 scripts to be covered by rsync', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        ecosystemConfig: exampleEcosystemConfig({ script: 'server.js' }),
        deployConfig: exampleDeployConfig(),
      }),
    /server\.js/,
  );
});
