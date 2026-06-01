/**
 * 文件说明: 执行 TinyShip 远程部署前检查，验证 SSH、Node、npm、PM2、rsync 和 appDir 权限。
 * 参考资料: packages/tinyship/README.md
 */
import { execFile } from 'node:child_process';

import { defaultRootDir, shellQuote, sshArgs, sshTarget } from './config.js';
import { createDeployPlan, validateDeployConfig } from './plan.js';
import type { DeployConfig, EcosystemConfig, PreflightCheck, PreflightReport, SshConfig } from './types.js';

const color = {
  bold: '\u001b[1m',
  green: '\u001b[32m',
  red: '\u001b[31m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
  reset: '\u001b[0m',
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

type CommandRunner = (command: string, args: string[], options: { rootDir: string }) => Promise<CommandResult>;

type PreflightReporter = {
  startCheck(check: { host: string; name: string; detail?: string }): void;
  endCheck(check: PreflightCheck): void;
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

function styleObjectLabel(label: string): string {
  return label.replace(/"([^"]*)"/g, (_, value: string) => `"${paint(value, 'green')}"`);
}

function trimOutput(result: CommandResult): string | undefined {
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return output.length > 0 ? output.split('\n')[0] : undefined;
}

function createSkippedCheck(host: string, name: string, detail: string | undefined, reason: string): PreflightCheck {
  return {
    host,
    name,
    detail,
    ok: true,
    skipped: true,
    output: reason,
  };
}

function commandText(command: string, args: string[]): string {
  return [command, ...args.map(arg => /\s|["'|&;]/.test(arg) ? shellQuote(arg) : arg)].join(' ');
}

function runCommand(command: string, args: string[], options: { rootDir: string }): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.rootDir,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${commandText(command, args)} failed: ${stderr.trim() || error.message}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function runCheck({
  host,
  name,
  detail,
  command,
  args,
  rootDir,
  runner,
  reporter,
}: {
  host: string;
  name: string;
  detail?: string;
  command: string;
  args: string[];
  rootDir: string;
  runner: CommandRunner;
  reporter?: PreflightReporter;
}): Promise<PreflightCheck> {
  reporter?.startCheck({ host, name, detail });
  try {
    const result = await runner(command, args, { rootDir });
    const check = {
      host,
      name,
      detail,
      ok: true,
      output: trimOutput(result),
    };
    reporter?.endCheck(check);
    return check;
  } catch (err) {
    const check = {
      host,
      name,
      detail,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    reporter?.endCheck(check);
    return check;
  }
}

function remoteCommand(ssh: SshConfig, command: string): string[] {
  const target = sshTarget(ssh);
  if (!target) throw new Error('preflight requires ssh.target or ssh.host');
  return [...sshArgs(ssh), target, command];
}

function parentDir(remotePath: string): string {
  const normalized = remotePath.replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return '/';
  return normalized.slice(0, index);
}

function appDirWritableCommand(appDir: string): string {
  const quotedAppDir = shellQuote(appDir);
  const quotedParentDir = shellQuote(parentDir(appDir));
  return [
    `if test -d ${quotedAppDir}; then`,
    `test -w ${quotedAppDir};`,
    'else',
    `test -d ${quotedParentDir} && test -w ${quotedParentDir};`,
    'fi',
  ].join(' ');
}

export async function createPreflightReport({
  deployConfig,
  ecosystemConfig,
  rootDir = defaultRootDir,
  runner = runCommand,
  reporter,
}: {
  deployConfig: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
  rootDir?: string;
  runner?: CommandRunner;
  reporter?: PreflightReporter;
}): Promise<PreflightReport> {
  validateDeployConfig({ deployConfig, ecosystemConfig });

  const hosts = [];
  const checks: PreflightCheck[] = [];

  for (const hostName of Object.keys(deployConfig.hosts)) {
    const plan = createDeployPlan({ hostName, ecosystemConfig, deployConfig });
    const target = sshTarget(plan.host.ssh) ?? undefined;
    const hostChecks: PreflightCheck[] = [];

    const checkInputs = [
      {
        name: 'ssh',
        detail: target,
        command: 'ssh',
        args: remoteCommand(plan.host.ssh, 'printf tinyship-preflight'),
      },
      {
        name: 'node',
        command: 'ssh',
        args: remoteCommand(plan.host.ssh, 'node --version'),
      },
      {
        name: 'npm',
        command: 'ssh',
        args: remoteCommand(plan.host.ssh, 'npm --version'),
      },
      {
        name: 'pm2',
        command: 'ssh',
        args: remoteCommand(plan.host.ssh, 'pm2 --version'),
      },
      {
        name: 'rsync',
        command: 'ssh',
        args: remoteCommand(plan.host.ssh, 'rsync --version | head -n 1'),
      },
      {
        name: 'appDir writable',
        detail: plan.host.appDir,
        command: 'ssh',
        args: remoteCommand(plan.host.ssh, appDirWritableCommand(plan.host.appDir)),
      },
    ];

    for (const input of checkInputs) {
      const check = await runCheck({ ...input, host: hostName, rootDir, runner, reporter });
      hostChecks.push(check);
      checks.push(check);

      if (check.name === 'ssh' && !check.ok) {
        for (const skippedInput of checkInputs.slice(1)) {
          const skippedCheck = createSkippedCheck(hostName, skippedInput.name, skippedInput.detail, 'skipped because SSH connection failed');
          reporter?.startCheck(skippedCheck);
          reporter?.endCheck(skippedCheck);
          hostChecks.push(skippedCheck);
          checks.push(skippedCheck);
        }
        break;
      }
    }

    hosts.push({
      name: hostName,
      sshTarget: target,
      appDir: plan.host.appDir,
      checks: hostChecks,
    });
  }

  const localRsync = await runCheck({
    host: 'local',
    name: 'rsync',
    command: 'rsync',
    args: ['--version'],
    rootDir,
    runner,
    reporter,
  });
  checks.push(localRsync);

  return {
    ok: checks.every(check => check.ok),
    hosts,
    checks,
  };
}

export function createConsolePreflightReporter(): PreflightReporter {
  let currentSubject: string | undefined;

  console.info('TinyShip Preflight: checking remote hosts and local deploy tools.');
  console.info('');

  function subjectFor(hostName: string): string {
    return hostName === 'local' ? 'Local' : styleObjectLabel(formatHost(hostName));
  }

  function printSubject(hostName: string): void {
    const subject = subjectFor(hostName);
    if (subject === currentSubject) return;

    if (currentSubject) console.info('');
    currentSubject = subject;
    console.info(subject);
  }

  return {
    startCheck(check) {
      printSubject(check.host);
      const detail = check.detail ? ` ${check.detail}` : '';
      console.info(`  Checking ${check.name}${detail}`);
    },
    endCheck(check) {
      const marker = check.skipped ? paint('SKIP', 'gray') : check.ok ? paint('PASS', 'green') : paint('FAIL', 'red');
      const output = check.output ? paint(` ${check.output}`, 'gray') : '';
      console.info(`    ${marker}${output}`);
      if (!check.ok) console.info(`    ${paint(check.error ?? 'unknown error', 'red')}`);
    },
  };
}

export function printPreflightReport(report: PreflightReport): void {
  const passed = report.checks.filter(item => item.ok && !item.skipped).length;
  const failed = report.checks.filter(item => !item.ok).length;
  const skipped = report.checks.filter(item => item.skipped).length;
  const status = report.ok ? paint('PASS', 'green') : paint('FAIL', 'red');
  const skippedText = skipped > 0 ? `, ${skipped} skipped` : '';

  console.info('');
  console.info(`${paint('TinyShip Preflight', 'bold')} ${status}: ${paint(String(passed), 'green')} passed, ${failed > 0 ? paint(String(failed), 'red') : '0'} failed${paint(skippedText, 'gray')} across ${report.hosts.length} hosts.`);
}
