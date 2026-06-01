/**
 * 文件说明: 生成并打印 TinyShip validate 报告，展示 host、service 和本地待发布文件检查结果。
 * 参考资料: packages/tinyship/src/plan.ts
 */
import { access } from 'node:fs/promises';

import { defaultRootDir, envFileForNodeEnv, projectPath, rsyncCoversPath, sshTarget, uniqueValues } from './config.js';
import { createDeployPlan, listDeployServices, validateEcosystemConfig, validateHost } from './plan.js';
import type { DeployConfig, EcosystemApp, EcosystemConfig, ValidationCheck, ValidationReport } from './types.js';

const color = {
  bold: '\u001b[1m',
  green: '\u001b[32m',
  red: '\u001b[31m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
  reset: '\u001b[0m',
};

function shouldUseColor(): boolean {
  if (process.env.FORCE_COLOR) return true;
  if (process.env.NO_COLOR) return false;
  return Boolean(process.stdout.isTTY);
}

function paint(value: string, style: keyof typeof color): string {
  if (!shouldUseColor()) return value;
  return `${color[style]}${value}${color.reset}`;
}

function formatHost(hostName: string): string {
  return `Host("${hostName}")`;
}

function formatService(serviceName: string): string {
  return `Service("${serviceName}")`;
}

function styleObjectLabel(label: string): string {
  return label.replace(/"([^"]*)"/g, (_, value: string) => `"${paint(value, 'green')}"`);
}

function formatDetail(detail: string | undefined): string {
  if (!detail) return '';
  return ` ${styleObjectLabel(detail)}`;
}

export async function createValidationReport({ deployConfig, ecosystemConfig, rootDir = defaultRootDir }: {
  deployConfig: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
  rootDir?: string;
}): Promise<ValidationReport> {
  const checks: ValidationCheck[] = [];

  function check<T>(group: string, name: string, detail: string, fn: () => T): T | undefined {
    try {
      const result = fn();
      checks.push({ group, name, detail, ok: true });
      return result;
    } catch (err) {
      checks.push({ group, name, detail, ok: false, error: err instanceof Error ? err.message : String(err) });
      return undefined;
    }
  }

  async function checkAsync<T>(group: string, name: string, detail: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      const result = await fn();
      checks.push({ group, name, detail, ok: true });
      return result;
    } catch (err) {
      checks.push({ group, name, detail, ok: false, error: err instanceof Error ? err.message : String(err) });
      return undefined;
    }
  }

  const hosts = check('config', 'deploy config hosts', 'hosts must be a non-empty object', () => {
    if (!deployConfig?.hosts || typeof deployConfig.hosts !== 'object' || Array.isArray(deployConfig.hosts)) {
      throw new Error('Deploy config must define hosts');
    }
    const hostNames = Object.keys(deployConfig.hosts);
    if (hostNames.length === 0) throw new Error('Deploy config hosts must not be empty');
    return hostNames;
  }) ?? [];

  const ecosystemApps: EcosystemApp[] = check('config', 'ecosystem apps', 'ecosystem.config.cjs must define PM2 apps', () => {
    if (!ecosystemConfig) throw new Error('Deploy validation requires ecosystemConfig');
    return validateEcosystemConfig(ecosystemConfig);
  }) ?? [];
  const services = check('config', 'deploy config services', 'services map service names to hosts', () => listDeployServices(deployConfig)) ?? [];

  for (const hostName of hosts) {
    check('hosts', formatHost(hostName), `${deployConfig.hosts[hostName]?.appDir ?? ''}`, () => validateHost(hostName, deployConfig.hosts[hostName]));
  }

  for (const serviceName of services) {
    const hostName = deployConfig.services[serviceName]?.host ?? '(missing)';
    check('services', formatService(serviceName), `host=${formatHost(hostName)}`, () => {
      const app = ecosystemApps.find(item => item.name === serviceName);
      if (!app) throw new Error(`Deploy service ${serviceName} is missing from PM2 ecosystem apps`);
      if (!app.env?.NODE_ENV) throw new Error(`PM2 service ${serviceName} is missing env.NODE_ENV`);
      return app;
    });
  }

  for (const hostName of hosts) {
    const plan = check(`plan:${formatHost(hostName)}`, 'create plan', 'services, NODE_ENV, env files', () => createDeployPlan({ hostName, ecosystemConfig, deployConfig }));
    if (!plan) continue;

    for (const envFile of plan.envFiles) {
      check(`plan:${formatHost(hostName)}`, 'env listed', envFile, () => {
        if (!plan.host.rsync.includes(envFile)) {
          throw new Error(`Deploy host ${hostName} rsync is missing required env file: ${envFile}`);
        }
      });
    }

    const serviceScriptPaths: string[] = [];
    for (const service of plan.services) {
      check(`plan:${formatHost(hostName)}`, 'script covered', formatService(service.name), () => {
        const app = ecosystemApps.find(item => item.name === service.name);
        if (!app) throw new Error(`Deploy service ${service.name} is missing from PM2 ecosystem apps`);
        if (!rsyncCoversPath(plan.host.rsync, app.script)) {
          throw new Error(`Deploy host ${hostName} rsync is missing PM2 script: ${app.script}`);
        }
        serviceScriptPaths.push(app.script);
      });
    }

    for (const rsyncPath of uniqueValues([...plan.host.rsync, ...serviceScriptPaths])) {
      await checkAsync(`files:${formatHost(hostName)}`, 'rsync path exists', rsyncPath, async () => {
        await access(projectPath(rootDir, rsyncPath));
      });
    }
  }

  return {
    ok: checks.every(item => item.ok),
    hosts: hosts.map(hostName => ({
      name: hostName,
      sshTarget: deployConfig.hosts[hostName]?.ssh ? sshTarget(deployConfig.hosts[hostName].ssh) ?? undefined : undefined,
      appDir: deployConfig.hosts[hostName]?.appDir,
      rsyncCount: deployConfig.hosts[hostName]?.rsync?.length ?? 0,
      serviceCount: services.filter(serviceName => deployConfig.services[serviceName]?.host === hostName).length,
    })),
    services: services.map(serviceName => {
      const service = deployConfig.services?.[serviceName];
      const app = ecosystemApps.find(item => item.name === serviceName);
      return {
        name: serviceName,
        host: service?.host,
        nodeEnv: app?.env?.NODE_ENV,
        script: app?.script,
        envFile: app?.env?.NODE_ENV ? envFileForNodeEnv(app.env.NODE_ENV) : undefined,
      };
    }),
    checks,
  };
}

export async function assertValidationReport({ deployConfig, ecosystemConfig, rootDir = defaultRootDir }: {
  deployConfig: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
  rootDir?: string;
}): Promise<void> {
  const report = await createValidationReport({ deployConfig, ecosystemConfig, rootDir });
  if (report.ok) return;

  const failedChecks = report.checks.filter(item => !item.ok);
  const details = failedChecks
    .slice(0, 5)
    .map(item => `${item.group} ${item.name}: ${item.error ?? 'unknown error'}`)
    .join('\n');
  throw new Error(`TinyShip validation failed (${failedChecks.length} failed)\n${details}`);
}

export function printValidationReport(report: ValidationReport): void {
  const passed = report.checks.filter(item => item.ok).length;
  const failed = report.checks.length - passed;
  const status = report.ok ? paint('PASS', 'green') : paint('FAIL', 'red');

  console.info(`${paint('TinyShip Validate', 'bold')} ${status}`);
  console.info(`${paint('Summary', 'cyan')}`);
  console.info(`  Checks: ${paint(String(passed), 'green')} passed, ${failed > 0 ? paint(String(failed), 'red') : '0'} failed`);
  console.info(`  Hosts: ${report.hosts.length}`);
  console.info(`  Services: ${report.services.length}`);

  console.info('');
  console.info(`${paint('Hosts', 'cyan')}`);
  for (const host of report.hosts) {
    console.info(`  ${paint('•', 'gray')} ${styleObjectLabel(formatHost(host.name))}`);
    console.info(`    ssh: ${host.sshTarget ?? '(missing)'}`);
    console.info(`    appDir: ${host.appDir ?? '(missing)'}`);
    console.info(`    rsync: ${host.rsyncCount} paths`);
    console.info(`    services: ${host.serviceCount}`);
  }

  console.info('');
  console.info(`${paint('Services', 'cyan')}`);
  for (const service of report.services) {
    console.info(`  ${paint('•', 'gray')} ${styleObjectLabel(formatService(service.name))}`);
    console.info(`    host: ${service.host ? styleObjectLabel(formatHost(service.host)) : '(missing)'}`);
    console.info(`    env: ${service.nodeEnv ?? '(missing)'}`);
    console.info(`    script: ${service.script ?? '(missing)'}`);
  }

  console.info('');
  console.info(`${paint('Checks', 'cyan')}`);
  const groups = [...new Set(report.checks.map(item => item.group))];
  for (const group of groups) {
    const checks = report.checks.filter(item => item.group === group);
    const groupPassed = checks.filter(item => item.ok).length;
    const groupFailed = checks.length - groupPassed;
    const groupStatus = groupFailed === 0 ? paint('PASS', 'green') : paint('FAIL', 'red');
    console.info(`  ${groupStatus} ${styleObjectLabel(group)} ${paint(`(${groupPassed}/${checks.length})`, 'gray')}`);

    for (const item of checks) {
      const marker = item.ok ? paint('✓', 'green') : paint('✗', 'red');
      const detail = formatDetail(item.detail);
      console.info(`    ${marker} ${styleObjectLabel(item.name)}${detail}`);
      if (!item.ok) console.info(`      ${paint(item.error ?? 'unknown error', 'red')}`);
    }
  }
}
