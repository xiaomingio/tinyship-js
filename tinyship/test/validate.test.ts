/**
 * 文件说明: 验证 TinyShip validate 报告会列出 hosts、services 和检查项。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createValidationReport } from '../dist/deploy.js';
import { exampleDeployConfig, exampleEcosystemConfig } from './fixtures.ts';

test('validation report lists hosts, services, and checks', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tinyship-validation-'));
  fs.mkdirSync(path.join(rootDir, 'dist/src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'dist/src/server.js'), '');
  fs.writeFileSync(path.join(rootDir, 'package.json'), '{}');
  fs.writeFileSync(path.join(rootDir, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(rootDir, 'ecosystem.config.cjs'), 'module.exports = { apps: [] };');
  fs.writeFileSync(path.join(rootDir, 'tinyship.config.yml'), '');
  fs.writeFileSync(path.join(rootDir, '.env.production'), '');

  const report = await createValidationReport({
    rootDir,
    ecosystemConfig: exampleEcosystemConfig(),
    deployConfig: exampleDeployConfig(),
  });

  assert.equal(report.hosts[0].name, 'web');
  assert.deepEqual(report.services.map(service => service.name), ['example-server']);
  assert.ok(report.checks.some(check => check.group === 'config' && check.name === 'deploy config hosts' && check.ok));
  assert.ok(report.checks.some(check => check.group === 'services' && check.name === 'Service("example-server")' && check.ok));
});
