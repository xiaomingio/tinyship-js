/**
 * 文件说明: 解析 TinyShip 命令行参数，并分发 deploy、validate 和 preflight 命令。
 */
import { defaultRootDir, loadDeployConfig, loadEcosystemConfig } from './config.js';
import { deployConfigNeedsEcosystemConfig } from './plan.js';
import { createConsolePreflightReporter, createPreflightReport, printPreflightReport } from './preflight.js';
import { deployAll, deployHost, deployService, dryRunAll, dryRunHost, dryRunService } from './runner.js';
import { createValidationReport, printValidationReport } from './validate.js';

const usage = 'Usage: tinyship deploy host <hostName> | deploy service <serviceName> | deploy all | dry-run host <hostName> | dry-run service <serviceName> | dry-run all | validate | preflight';

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
  const ecosystemConfig = deployConfigNeedsEcosystemConfig(deployConfig)
    ? await loadEcosystemConfig(undefined, rootDir)
    : undefined;

  if (command === 'deploy') {
    try {
      if (scope === 'all' && !targetName) {
        await deployAll({ deployConfig, ecosystemConfig, rootDir });
      } else if (scope === 'host' && targetName) {
        await deployHost({ hostName: targetName, deployConfig, ecosystemConfig, rootDir });
      } else if (scope === 'service' && targetName) {
        await deployService({ serviceName: targetName, deployConfig, ecosystemConfig, rootDir });
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
        await dryRunAll({ deployConfig, ecosystemConfig, rootDir });
      } else if (scope === 'host' && targetName) {
        await dryRunHost({ hostName: targetName, deployConfig, ecosystemConfig, rootDir });
      } else if (scope === 'service' && targetName) {
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
    const report = await createValidationReport({ deployConfig, ecosystemConfig, rootDir });
    printValidationReport(report);
    if (!report.ok) process.exit(1);
    return;
  }

  if (command === 'preflight' && !scope) {
    const report = await createPreflightReport({ deployConfig, ecosystemConfig, rootDir, reporter: createConsolePreflightReporter() });
    printPreflightReport(report);
    if (!report.ok) process.exit(1);
    return;
  }

  console.error(usage);
  process.exit(1);
}
