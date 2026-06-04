/**
 * 文件说明: 解析 TinyShip 命令行参数，并分发 deploy、validate 和 preflight 命令。
 */
import { defaultRootDir, loadDeployConfig, loadEcosystemConfig, sshTarget } from './config.js';
import { deployConfigNeedsEcosystemConfig } from './plan.js';
import { createConsolePreflightReporter, createPreflightReport, printPreflightReport } from './preflight.js';
import { deployAll, deployHost, deployService, dryRunAll, dryRunHost, dryRunService } from './runner.js';
import type { DeployConfig } from './types.js';
import { createValidationReport, printValidationReport } from './validate.js';

const usage = 'Usage: tinyship deploy host <hostName> | deploy service <serviceName> | deploy all | dry-run host <hostName> | dry-run service <serviceName> | dry-run all | validate | preflight';

function printDeployTargets(deployConfig: DeployConfig): void {
  console.error('Configured hosts:');
  for (const [hostName, host] of Object.entries(deployConfig.hosts ?? {})) {
    const serviceCount = Object.values(deployConfig.services ?? {}).filter(service => service.host === hostName).length;
    const target = sshTarget(host.ssh) ?? '(missing ssh target)';
    console.error(`- ${hostName}: ssh=${target}, appDir=${host.appDir}, rsync=${host.rsync?.length ?? 0}, services=${serviceCount}`);
  }

  console.error('Configured services:');
  for (const [serviceName, service] of Object.entries(deployConfig.services ?? {})) {
    console.error(`- ${serviceName}: host=${service.host}, npmInstall=${service.npmInstall ?? true}, pm2Restart=${service.pm2Restart ?? true}, postCommand=${service.postCommand?.length ?? 0}`);
  }
}

export async function main(argv: string[] = process.argv.slice(2), rootDir = defaultRootDir): Promise<void> {
  const [command, scope, targetName, ...extraArgs] = argv;

  if (argv.includes('--help') || argv.includes('-h')) {
    console.info(usage);
    return;
  }

  if (extraArgs.length > 0) {
    console.error(`Unexpected arguments: ${extraArgs.join(' ')}`);
    console.error(usage);
    process.exit(1);
  }

  const deployConfig = await loadDeployConfig('tinyship.config.yml', rootDir);
  const loadProjectEcosystemConfig = async () => deployConfigNeedsEcosystemConfig(deployConfig)
    ? await loadEcosystemConfig(undefined, rootDir)
    : undefined;

  if (command === 'deploy') {
    try {
      if (scope === 'all' && !targetName) {
        const ecosystemConfig = await loadProjectEcosystemConfig();
        await deployAll({ deployConfig, ecosystemConfig, rootDir });
      } else if (scope === 'host' && targetName) {
        const ecosystemConfig = await loadProjectEcosystemConfig();
        await deployHost({ hostName: targetName, deployConfig, ecosystemConfig, rootDir });
      } else if (scope === 'service' && targetName) {
        const ecosystemConfig = await loadProjectEcosystemConfig();
        await deployService({ serviceName: targetName, deployConfig, ecosystemConfig, rootDir });
      } else if (!scope && !targetName) {
        console.error(usage);
        printDeployTargets(deployConfig);
        process.exit(1);
      } else {
        console.error(usage);
        process.exit(1);
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      console.error(`Expected one of: ${Object.keys(deployConfig.hosts).join(', ')}`);
      process.exit(1);
    }
    return;
  }

  if (command === 'dry-run') {
    try {
      if (scope === 'all' && !targetName) {
        const ecosystemConfig = await loadProjectEcosystemConfig();
        await dryRunAll({ deployConfig, ecosystemConfig, rootDir });
      } else if (scope === 'host' && targetName) {
        const ecosystemConfig = await loadProjectEcosystemConfig();
        await dryRunHost({ hostName: targetName, deployConfig, ecosystemConfig, rootDir });
      } else if (scope === 'service' && targetName) {
        const ecosystemConfig = await loadProjectEcosystemConfig();
        await dryRunService({ serviceName: targetName, deployConfig, ecosystemConfig, rootDir });
      } else {
        console.error(usage);
        process.exit(1);
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      console.error(`Expected one of: ${Object.keys(deployConfig.hosts).join(', ')}`);
      process.exit(1);
    }
    return;
  }

  if (command === 'validate' && !scope) {
    const ecosystemConfig = await loadProjectEcosystemConfig();
    const report = await createValidationReport({ deployConfig, ecosystemConfig, rootDir });
    printValidationReport(report);
    if (!report.ok) process.exit(1);
    return;
  }

  if (command === 'preflight' && !scope) {
    const ecosystemConfig = await loadProjectEcosystemConfig();
    const report = await createPreflightReport({ deployConfig, ecosystemConfig, rootDir, reporter: createConsolePreflightReporter() });
    printPreflightReport(report);
    if (!report.ok) process.exit(1);
    return;
  }

  console.error(usage);
  process.exit(1);
}
