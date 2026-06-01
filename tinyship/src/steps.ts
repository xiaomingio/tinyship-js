/**
 * 文件说明: 定义单台 host 发布时的显式步骤列表，集中展示 TinyShip 实际执行顺序。
 * 参考资料: packages/tinyship/README.md
 */
import { ecosystemFile, rsyncSshArgs, shellQuote, sshArgs, sshTarget } from './config.js';
import { assertEnvFiles, validateDeployFiles } from './files.js';
import { run } from './run.js';
import type { CommandRunner, DeployConfig, DeployPlan, DeployStep, EcosystemConfig } from './types.js';

function requireSshTarget(plan: DeployPlan): string {
  const target = sshTarget(plan.host.ssh);
  if (!target) throw new Error(`Deploy host ${plan.name} must define ssh.target or ssh.host`);
  return target;
}

function remoteShellQuote(input: string): string {
  return `"${input.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('$', '\\$').replaceAll('`', '\\`')}"`;
}

async function ensureRemoteDirs(plan: DeployPlan, rootDir: string, runner: CommandRunner): Promise<void> {
  const target = requireSshTarget(plan);

  await runner('ssh', [...sshArgs(plan.host.ssh), target, 'mkdir', '-p', plan.host.appDir], { rootDir });
}

async function rsyncDeployPaths(plan: DeployPlan, rootDir: string, runner: CommandRunner): Promise<void> {
  const target = requireSshTarget(plan);
  const sources = plan.host.rsync.map(path => path.replace(/\/+$/, ''));

  await runner('rsync', [
    '-az',
    '--delete',
    '--relative',
    ...rsyncSshArgs(plan.host.ssh),
    ...sources,
    `${target}:${plan.host.appDir}/`,
  ], { rootDir });
}

async function installDependenciesAndReloadPm2(plan: DeployPlan, rootDir: string, runner: CommandRunner): Promise<void> {
  const target = requireSshTarget(plan);
  const remoteCommand = [
    'set -e',
    `cd ${remoteShellQuote(plan.host.appDir)}`,
    'npm install --omit=dev',
    ...plan.services.map(service => `pm2 startOrReload ${remoteShellQuote(ecosystemFile)} --only ${remoteShellQuote(service.name)} --update-env`),
    'pm2 save',
  ].join('\n');

  await runner('ssh', [...sshArgs(plan.host.ssh), target, remoteCommand], { rootDir });
}

export function createDeploySteps({ plan, deployConfig, ecosystemConfig, rootDir, runner = run }: {
  plan: DeployPlan;
  deployConfig: DeployConfig;
  ecosystemConfig: EcosystemConfig;
  rootDir: string;
  runner?: CommandRunner;
}): DeployStep[] {
  return [
    {
      name: 'validate env files',
      detail: plan.envFiles.join(', '),
      run: () => assertEnvFiles(plan, rootDir),
    },
    {
      name: 'validate rsync files',
      detail: plan.host.rsync.join(', '),
      run: () => validateDeployFiles({ deployConfig, ecosystemConfig, rootDir }),
    },
    {
      name: 'prepare remote directories',
      detail: `${requireSshTarget(plan)}:${plan.host.appDir}`,
      run: () => ensureRemoteDirs(plan, rootDir, runner),
    },
    {
      name: 'rsync deploy paths',
      detail: `${plan.host.rsync.length} paths`,
      run: () => rsyncDeployPaths(plan, rootDir, runner),
    },
    {
      name: 'install dependencies and reload PM2',
      detail: plan.services.map(service => service.name).join(', '),
      run: () => installDependenciesAndReloadPm2(plan, rootDir, runner),
    },
  ];
}
