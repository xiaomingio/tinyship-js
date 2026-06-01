/**
 * 文件说明: 解析 TinyShip 命令行参数，并分发 deploy、validate 和 preflight 命令。
 */
import { defaultRootDir, loadDeployConfig, loadEcosystemConfig } from './config.js';
import { createConsolePreflightReporter, createPreflightReport, printPreflightReport } from './preflight.js';
import { deployAll, deployHost, dryRunAll, dryRunHost } from './runner.js';
import { createValidationReport, printValidationReport } from './validate.js';

const usage = 'Usage: tinyship deploy <hostName|all> | dry-run <hostName|all> | validate | preflight';

export async function main(argv: string[] = process.argv.slice(2), rootDir = defaultRootDir): Promise<void> {
  const [command, hostName, ...extraArgs] = argv;

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
  const ecosystemConfig = await loadEcosystemConfig(undefined, rootDir);

  if (command === 'deploy' && hostName) {
    try {
      if (hostName === 'all') {
        await deployAll({ deployConfig, ecosystemConfig, rootDir });
      } else {
        await deployHost({ hostName, deployConfig, ecosystemConfig, rootDir });
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      console.error(`Expected one of: ${Object.keys(deployConfig.hosts).join(', ')}`);
      process.exit(1);
    }
    return;
  }

  if (command === 'dry-run' && hostName) {
    try {
      if (hostName === 'all') {
        await dryRunAll({ deployConfig, ecosystemConfig, rootDir });
      } else {
        await dryRunHost({ hostName, deployConfig, ecosystemConfig, rootDir });
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      console.error(`Expected one of: ${Object.keys(deployConfig.hosts).join(', ')}`);
      process.exit(1);
    }
    return;
  }

  if (command === 'validate' && !hostName) {
    const report = await createValidationReport({ deployConfig, ecosystemConfig, rootDir });
    printValidationReport(report);
    if (!report.ok) process.exit(1);
    return;
  }

  if (command === 'preflight' && !hostName) {
    const report = await createPreflightReport({ deployConfig, ecosystemConfig, rootDir, reporter: createConsolePreflightReporter() });
    printPreflightReport(report);
    if (!report.ok) process.exit(1);
    return;
  }

  console.error(usage);
  process.exit(1);
}
