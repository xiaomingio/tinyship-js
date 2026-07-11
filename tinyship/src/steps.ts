/**
 * 文件说明: 定义单台 host 发布时的显式步骤列表，集中展示 TinyShip 实际执行顺序。
 * 参考资料: packages/tinyship/README.md
 */
import { rsyncSshArgs, sshArgs, sshTarget } from './config.js';
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
  const sources = plan.rsync.map(path => path.replace(/\/+$/, ''));

  await runner('rsync', [
    '-az',
    '--delete',
    '--relative',
    ...rsyncSshArgs(plan.host.ssh),
    ...sources,
    `${target}:${plan.host.appDir}/`,
  ], { rootDir });
}

async function runRemoteCommand(plan: DeployPlan, rootDir: string, runner: CommandRunner, commands: string[]): Promise<void> {
  const target = requireSshTarget(plan);
  const remoteCommand = [
    'set -e',
    `cd ${remoteShellQuote(plan.host.appDir)}`,
    ...commands,
  ].join('\n');

  await runner('ssh', [...sshArgs(plan.host.ssh), target, remoteCommand], { rootDir });
}

async function npmInstall(plan: DeployPlan, rootDir: string, runner: CommandRunner): Promise<void> {
  if (!plan.npmInstallCommand) return;
  await runRemoteCommand(plan, rootDir, runner, [plan.npmInstallCommand]);
}

async function pm2Restart(plan: DeployPlan, rootDir: string, runner: CommandRunner): Promise<void> {
  if (!plan.pm2Restart) return;
  const serviceNames = plan.pm2Restart.services.map(service => service.name);
  const script = [
    "const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path')",
    `const appDir=${JSON.stringify(plan.host.appDir)},ecosystem=${JSON.stringify(plan.pm2Restart.ecosystem)},selected=${JSON.stringify(serviceNames)}`,
    "const config=require(path.resolve(ecosystem)),apps=new Map(config.apps.map(a=>[a.name,a]))",
    "cp.execFileSync('pm2',['ping'],{stdio:'ignore'})",
    "const current=JSON.parse(cp.execFileSync('pm2',['jlist'],{encoding:'utf8'}))",
    "const changed=[],missing=[],stable=[]",
    "const norm=v=>Array.isArray(v)?v.join(' '):String(v??'').trim(),real=v=>fs.realpathSync(path.resolve(v))",
    "for(const name of selected){const app=apps.get(name);if(!app)throw new Error('Missing ecosystem app: '+name);const rows=current.filter(p=>p.name===name);if(!rows.length){missing.push(name);continue}for(const row of rows){if(real(row.pm2_env.pm_cwd)!==real(appDir))throw new Error('PM2 name conflict: '+name+' belongs to '+row.pm2_env.pm_cwd)}const env=rows[0].pm2_env;const desiredScript=real(path.resolve(appDir,app.script)),desiredCwd=real(path.resolve(appDir,app.cwd??'.')),desiredMode=(app.exec_mode??(app.instances!==undefined?'cluster':'fork'))+'_mode',desiredInterpreter=app.interpreter??'node',desiredInstances=Number(app.instances??1);const same=real(env.pm_exec_path)===desiredScript&&real(env.pm_cwd)===desiredCwd&&path.basename(env.exec_interpreter??'node')===path.basename(desiredInterpreter)&&norm(env.node_args)===norm(app.node_args)&&env.exec_mode===desiredMode&&Number(env.instances??rows.length)===desiredInstances;(same?stable:changed).push(name)}",
    "const run=args=>cp.execFileSync('pm2',args,{stdio:'inherit'})",
    "if(stable.length)run(['startOrReload',ecosystem,'--only',stable.join(','),'--update-env'])",
    "if(changed.length)run(['delete',...changed])",
    "const start=[...changed,...missing];if(start.length)run(['start',ecosystem,'--only',start.join(','),'--update-env'])",
    "run(['save'])",
  ].join(';');
  await runRemoteCommand(plan, rootDir, runner, [
    `node -e ${remoteShellQuote(script)}`,
  ]);
}

async function postCommand(plan: DeployPlan, rootDir: string, runner: CommandRunner): Promise<void> {
  if (plan.postCommand.length === 0) return;
  await runRemoteCommand(plan, rootDir, runner, plan.postCommand);
}

export function createDeploySteps({ plan, deployConfig, ecosystemConfig, rootDir, runner = run }: {
  plan: DeployPlan;
  deployConfig: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
  rootDir: string;
  runner?: CommandRunner;
}): DeployStep[] {
  const steps: DeployStep[] = [];

  if (plan.envFiles.length > 0) {
    steps.push({
      name: 'validate env files',
      detail: plan.envFiles.join(', '),
      run: () => assertEnvFiles(plan, rootDir),
    });
  }

  steps.push(
    {
      name: 'validate rsync files',
      detail: plan.rsync.join(', '),
      run: () => validateDeployFiles({ deployConfig, ecosystemConfig, rootDir }),
    },
    {
      name: 'prepare remote directories',
      detail: `${requireSshTarget(plan)}:${plan.host.appDir}`,
      run: () => ensureRemoteDirs(plan, rootDir, runner),
    },
    {
      name: 'rsync deploy paths',
      detail: `${plan.rsync.length} paths`,
      run: () => rsyncDeployPaths(plan, rootDir, runner),
    },
  );

  if (plan.npmInstallCommand) {
    steps.push({
      name: 'npm install',
      detail: plan.npmInstallCommand,
      run: () => npmInstall(plan, rootDir, runner),
    });
  }

  if (plan.pm2Restart) {
    steps.push({
      name: 'pm2 restart',
      detail: plan.pm2Restart.services.map(service => service.name).join(', '),
      run: () => pm2Restart(plan, rootDir, runner),
    });
  }

  if (plan.postCommand.length > 0) {
    steps.push({
      name: 'post command',
      detail: `${plan.postCommand.length} commands`,
      run: () => postCommand(plan, rootDir, runner),
    });
  }

  return steps;
}
