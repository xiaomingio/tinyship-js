/**
 * 文件说明: 执行 TinyShip 发布计划，按 steps.ts 中定义的步骤发布单台或全部 host。
 */
import { defaultRootDir, loadDeployConfig, loadEcosystemConfig, sshTarget } from './config.js';
import { createDeployPlan } from './plan.js';
import { dryRun } from './run.js';
import { createDeploySteps } from './steps.js';
import { assertValidationReport } from './validate.js';
import type { CommandRunner, DeployConfig, EcosystemConfig } from './types.js';

const color = {
  cyan: '\u001b[36m',
  reset: '\u001b[0m',
};

function shouldUseColor(): boolean {
  if (process.env.FORCE_COLOR) return true;
  if (process.env.NO_COLOR) return false;
  return Boolean(process.stdout.isTTY);
}

function paintComment(value: string): string {
  if (!shouldUseColor()) return value;
  return `${color.cyan}${value}${color.reset}`;
}

function printDryRunComment(value: string): void {
  console.info('');
  console.info(paintComment(value));
}

async function runHostDeployment({ hostName, deployConfig, ecosystemConfig, rootDir, runner, dryRunMode = false }: {
  hostName: string;
  deployConfig: DeployConfig;
  ecosystemConfig: EcosystemConfig;
  rootDir?: string;
  runner?: CommandRunner;
  dryRunMode?: boolean;
}): Promise<void> {
  await assertValidationReport({ deployConfig, ecosystemConfig, rootDir });

  const plan = createDeployPlan({ hostName, ecosystemConfig, deployConfig });
  const remote = sshTarget(plan.host.ssh);
  if (dryRunMode) {
    printDryRunComment(`# Dry run ${hostName} to ${remote}:${plan.host.appDir}`);
  } else {
    console.info(`Deploying ${hostName} to ${remote}:${plan.host.appDir}`);
  }

  const steps = createDeploySteps({ plan, deployConfig, ecosystemConfig, rootDir: rootDir ?? defaultRootDir, runner });
  for (const [index, step] of steps.entries()) {
    const stepLabel = `[${index + 1}/${steps.length}] ${step.name}${step.detail ? `: ${step.detail}` : ''}`;
    if (dryRunMode) {
      printDryRunComment(`# ${stepLabel}`);
    } else {
      console.info(stepLabel);
    }
    await step.run();
  }

  if (dryRunMode) {
    printDryRunComment('# Dry run complete.');
  } else {
    console.info('Deploy complete.');
  }
}

export async function deployHost({ hostName, deployConfig, ecosystemConfig, rootDir = defaultRootDir }: {
  hostName: string;
  deployConfig?: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
  rootDir?: string;
}): Promise<void> {
  deployConfig ??= await loadDeployConfig('tinyship.config.yml', rootDir);
  ecosystemConfig ??= await loadEcosystemConfig(undefined, rootDir);
  await runHostDeployment({ hostName, deployConfig, ecosystemConfig, rootDir });
}

export async function deployAll({ deployConfig, ecosystemConfig, rootDir = defaultRootDir }: {
  deployConfig?: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
  rootDir?: string;
} = {}): Promise<void> {
  deployConfig ??= await loadDeployConfig('tinyship.config.yml', rootDir);
  ecosystemConfig ??= await loadEcosystemConfig(undefined, rootDir);

  for (const hostName of Object.keys(deployConfig.hosts)) {
    await deployHost({ hostName, deployConfig, ecosystemConfig, rootDir });
  }
}

export async function dryRunHost({ hostName, deployConfig, ecosystemConfig, rootDir = defaultRootDir }: {
  hostName: string;
  deployConfig?: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
  rootDir?: string;
}): Promise<void> {
  deployConfig ??= await loadDeployConfig('tinyship.config.yml', rootDir);
  ecosystemConfig ??= await loadEcosystemConfig(undefined, rootDir);
  await runHostDeployment({ hostName, deployConfig, ecosystemConfig, rootDir, runner: dryRun, dryRunMode: true });
}

export async function dryRunAll({ deployConfig, ecosystemConfig, rootDir = defaultRootDir }: {
  deployConfig?: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
  rootDir?: string;
} = {}): Promise<void> {
  deployConfig ??= await loadDeployConfig('tinyship.config.yml', rootDir);
  ecosystemConfig ??= await loadEcosystemConfig(undefined, rootDir);

  for (const hostName of Object.keys(deployConfig.hosts)) {
    await dryRunHost({ hostName, deployConfig, ecosystemConfig, rootDir });
  }
}
