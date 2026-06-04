/**
 * 文件说明: 验证 TinyShip preflight 会检查 SSH、远程依赖、本地 rsync 和 appDir 权限。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createConsolePreflightReporter, createPreflightReport, printPreflightReport } from '../dist/deploy.js';
import { exampleDeployConfig, exampleEcosystemConfig } from './fixtures.ts';

test('preflight checks ssh, remote tools, appDir, and local rsync', async () => {
  const commands = [];
  const report = await createPreflightReport({
    rootDir: process.cwd(),
    ecosystemConfig: exampleEcosystemConfig(),
    deployConfig: exampleDeployConfig({
      ssh: { user: 'deploy', host: '203.0.113.10', port: 2222 },
    }),
    runner: async (command, args) => {
      commands.push([command, args]);
      return { stdout: `${command}-ok\n`, stderr: '' };
    },
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.hosts.map(host => host.name), ['web']);
  assert.ok(commands.some(([command, args]) => command === 'ssh' && args.includes('node --version')));
  assert.ok(commands.some(([command, args]) => command === 'ssh' && args.includes('npm --version')));
  assert.ok(commands.some(([command, args]) => command === 'ssh' && args.includes('pm2 --version')));
  assert.ok(commands.some(([command, args]) => command === 'ssh' && args.includes('rsync --version | head -n 1')));
  assert.ok(commands.some(([command, args]) => command === 'ssh' && args.some(arg => arg.includes('if test -d') && arg.includes('test -w') && arg.includes('fi'))));
  assert.equal(commands.some(([command, args]) => command === 'ssh' && args.includes('bash')), false);
  assert.equal(commands.some(([command, args]) => command === 'ssh' && args.includes('-lc')), false);
  assert.equal(commands.some(([, args]) => args.some(arg => arg.includes('mkdir'))), false);
  assert.ok(commands.some(([command, args]) => command === 'rsync' && args.includes('--version')));
});

test('preflight reporter prints each check as it runs', async () => {
  const logs: string[] = [];
  const originalInfo = console.info;
  console.info = (message?: unknown) => {
    logs.push(String(message));
  };

  try {
    await createPreflightReport({
      rootDir: process.cwd(),
      ecosystemConfig: exampleEcosystemConfig(),
      deployConfig: exampleDeployConfig(),
      reporter: createConsolePreflightReporter(),
      runner: async command => ({ stdout: `${command}-ok\n`, stderr: '' }),
    });
  } finally {
    console.info = originalInfo;
  }

  assert.ok(logs.some(line => line.includes('Host("web")')));
  assert.ok(logs.some(line => line.includes('Checking ssh')));
  assert.ok(logs.some(line => line.includes('Checking appDir writable')));
  assert.ok(logs.some(line => line.includes('Local')));
  assert.ok(logs.some(line => line.includes('Checking rsync')));
  assert.ok(logs.some(line => line.includes('PASS')));
});

test('preflight skips host checks when SSH connection fails', async () => {
  const commands = [];
  const report = await createPreflightReport({
    rootDir: process.cwd(),
    ecosystemConfig: exampleEcosystemConfig(),
    deployConfig: exampleDeployConfig(),
    runner: async (command, args) => {
      commands.push([command, args]);
      if (command === 'ssh') throw new Error('ssh failed');
      return { stdout: `${command}-ok\n`, stderr: '' };
    },
  });

  const hostChecks = report.hosts[0].checks;
  assert.equal(report.ok, false);
  assert.equal(commands.filter(([command]) => command === 'ssh').length, 1);
  assert.equal(hostChecks.filter(check => check.skipped).length, 5);
  assert.ok(hostChecks.some(check => check.name === 'node' && check.skipped));
});

test('preflight only checks tools required by enabled actions', async () => {
  const commands = [];
  const report = await createPreflightReport({
    rootDir: process.cwd(),
    deployConfig: exampleDeployConfig({
      npmInstall: false,
      pm2Restart: false,
      rsync: ['dist/'],
    }),
    runner: async (command, args) => {
      commands.push([command, args]);
      return { stdout: `${command}-ok\n`, stderr: '' };
    },
  });

  assert.equal(report.ok, true);
  assert.equal(commands.some(([command, args]) => command === 'ssh' && args.includes('node --version')), false);
  assert.equal(commands.some(([command, args]) => command === 'ssh' && args.includes('npm --version')), false);
  assert.equal(commands.some(([command, args]) => command === 'ssh' && args.includes('pm2 --version')), false);
  assert.ok(commands.some(([command, args]) => command === 'ssh' && args.includes('rsync --version | head -n 1')));
});

test('preflight summary does not repeat item details', async () => {
  const report = await createPreflightReport({
    rootDir: process.cwd(),
    ecosystemConfig: exampleEcosystemConfig(),
    deployConfig: exampleDeployConfig(),
    runner: async command => ({ stdout: `${command}-ok\n`, stderr: '' }),
  });
  const logs: string[] = [];
  const originalInfo = console.info;
  console.info = (message?: unknown) => {
    logs.push(String(message));
  };

  try {
    printPreflightReport(report);
  } finally {
    console.info = originalInfo;
  }

  assert.ok(logs.some(line => line.includes('TinyShip Preflight')));
  assert.equal(logs.some(line => line.includes('Host("web")')), false);
  assert.equal(logs.some(line => line.includes('✓ node')), false);
  assert.equal(logs.some(line => line.includes('Checking node')), false);
});
