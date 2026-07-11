/**
 * 文件说明: 验证 TinyShip 部署计划的通用推导与配置校验规则。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeployPlan, validateDeployConfig } from '../dist/deploy.js';
import { exampleDeployConfig, exampleEcosystemConfig, requiredRsync } from './fixtures.ts';

test('deploy plan derives production env files from application directories', () => {
  const plan = createDeployPlan({
    hostName: 'web',
    ecosystemConfig: {
      apps: [
        {
          name: 'example-server',
          script: 'apps/web/dist/server.js',
          env: { NODE_ENV: 'production' },
        },
        {
          name: 'example-worker',
          script: 'apps/worker/dist/worker.js',
          env: { NODE_ENV: 'production' },
        },
      ],
    },
    deployConfig: {
      hosts: {
        web: {
          ssh: { target: 'root@example.com' },
          appDir: '/var/www/example',
          rsync: [...requiredRsync, 'apps/web/', 'apps/worker/', 'apps/web/.env.production', 'apps/worker/.env.production'],
        },
      },
      services: {
        'example-server': { host: 'web', npmInstall: true, pm2Restart: true, postCommand: [] },
        'example-worker': { host: 'web', npmInstall: false, pm2Restart: true, postCommand: [] },
      },
    },
  });

  assert.deepEqual(plan.envFiles, ['apps/web/.env.production', 'apps/worker/.env.production']);
  assert.deepEqual(plan.services.map(service => service.nodeEnv), ['production', 'production']);
  assert.deepEqual(plan.host.ssh, { target: 'root@example.com' });
});

test('deploy validation accepts static hosts without services or ecosystem', () => {
  assert.doesNotThrow(() =>
    validateDeployConfig({
      deployConfig: {
        hosts: {
          static: {
            ssh: { target: 'root@example.com' },
            appDir: '/var/www/static',
            rsync: ['dist/'],
          },
        },
        services: {
          static: { host: 'static', npmInstall: false, pm2Restart: false, postCommand: [] },
        },
      },
    }),
  );
});

test('deploy plan can target one service while still using the host rsync list', () => {
  const deployConfig = {
    hosts: {
      web: {
        ssh: { target: 'root@example.com' },
        appDir: '/var/www/example',
        rsync: ['dist/', ...requiredRsync, '.env.production', '.env.production'],
      },
    },
    services: {
      'example-server': { host: 'web', npmInstall: true, pm2Restart: true, postCommand: ['printf server'] },
      'example-worker': { host: 'web', npmInstall: false, pm2Restart: true, postCommand: ['printf worker'] },
    },
  };

  const plan = createDeployPlan({
    hostName: 'web',
    serviceNames: ['example-server'],
    ecosystemConfig: {
      apps: [
        { name: 'example-server', script: 'dist/src/server.js', env: { NODE_ENV: 'production' } },
        { name: 'example-worker', script: 'dist/src/worker.js', env: { NODE_ENV: 'production' } },
      ],
    },
    deployConfig,
  });

  assert.deepEqual(plan.services.map(service => service.name), ['example-server']);
  assert.deepEqual(plan.envFiles, ['.env.production']);
  assert.equal(plan.npmInstallCommand, 'npm install --omit=dev');
  assert.deepEqual(plan.pm2Restart?.services.map(service => service.name), ['example-server']);
  assert.deepEqual(plan.postCommand, ['printf server']);
  assert.deepEqual(plan.host.rsync, deployConfig.hosts.web.rsync);
});

test('deploy validation requires ecosystem to be uploaded when pm2Restart is enabled', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        ecosystemConfig: exampleEcosystemConfig(),
        deployConfig: exampleDeployConfig({
          rsync: ['dist/', 'package.json', 'package-lock.json', 'tinyship.config.yml', '.env.production'],
        }),
      }),
    /ecosystem\.config\.cjs/,
  );
});

test('deploy validation rejects empty custom post commands', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        deployConfig: exampleDeployConfig({
          npmInstall: false,
          pm2Restart: false,
          postCommand: [''],
          rsync: ['dist/'],
        }),
      }),
    /postCommand/,
  );
});

test('deploy validation requires package json when npmInstall is enabled', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        deployConfig: exampleDeployConfig({
          npmInstall: true,
          pm2Restart: false,
          rsync: ['dist/'],
        }),
      }),
    /package\.json/,
  );
});

test('deploy validation rejects custom npmInstall config objects', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        deployConfig: exampleDeployConfig({
          npmInstall: { command: 'npm ci --omit=dev' },
          pm2Restart: false,
          rsync: ['dist/'],
        }),
      }),
    /npmInstall must be a boolean/,
  );
});

test('deploy validation rejects custom pm2Restart config objects', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        ecosystemConfig: exampleEcosystemConfig(),
        deployConfig: exampleDeployConfig({
          pm2Restart: { services: ['example-server'] },
        }),
      }),
    /pm2Restart must be a boolean/,
  );
});

test('deploy validation requires NODE_ENV to be production', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        ecosystemConfig: exampleEcosystemConfig({ nodeEnv: 'development' }),
        deployConfig: exampleDeployConfig(),
      }),
    /production/,
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

test('deploy validation does not require tinyship config to be uploaded', () => {
  assert.doesNotThrow(() =>
    validateDeployConfig({
      ecosystemConfig: exampleEcosystemConfig(),
      deployConfig: exampleDeployConfig({
        rsync: ['dist/src/', 'package.json', 'package-lock.json', 'ecosystem.config.cjs', '.env.production'],
      }),
    }),
  );
});

test('deploy validation still requires enabled pm2Restart ecosystem to be uploaded', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        ecosystemConfig: exampleEcosystemConfig(),
        deployConfig: exampleDeployConfig({
          rsync: ['dist/src/', 'package.json', 'package-lock.json', '.env.production'],
        }),
      }),
    /ecosystem\.config\.cjs/,
  );
});

test('deploy validation accepts a dist subdirectory when it covers PM2 scripts', () => {
  assert.doesNotThrow(() =>
    validateDeployConfig({
      ecosystemConfig: exampleEcosystemConfig({ script: 'dist/src/server.js' }),
      deployConfig: exampleDeployConfig({
        rsync: ['dist/src', ...requiredRsync, '.env.production'],
      }),
    }),
  );
});

test('deploy validation requires env files to be listed in rsync', () => {
  assert.throws(
    () =>
      validateDeployConfig({
        ecosystemConfig: exampleEcosystemConfig(),
        deployConfig: exampleDeployConfig({ rsync: requiredRsync }),
      }),
    /\.env\.production/,
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
