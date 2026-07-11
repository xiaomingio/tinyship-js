/**
 * 文件说明: TinyShip 公共 API 汇总入口，向测试和使用方导出配置、计划、校验与发布能力。
 */
export { envFileForApp, loadDeployConfig, loadDeployEcosystemConfigs, loadEcosystemConfig } from './config.js';
export { createDeployPlan, deployConfigNeedsEcosystemConfig, ecosystemConfigForHost, validateDeployConfig, validateEcosystemConfig } from './plan.js';
export { createConsolePreflightReporter, createPreflightReport, printPreflightReport } from './preflight.js';
export { assertValidationReport, createValidationReport, printValidationReport } from './validate.js';
export { validateDeployFiles } from './files.js';
export { deployAll, deployHost, deployService, dryRunAll, dryRunHost, dryRunService } from './runner.js';
export { createDeploySteps } from './steps.js';
export { main } from './cli.js';
export type {
  DeployConfig,
  DeployHost,
  DeployPlan,
  DeployPlanService,
  DeployService,
  DeployStep,
  CommandRunner,
  EcosystemApp,
  EcosystemConfig,
  EcosystemConfigSource,
  PreflightCheck,
  PreflightReport,
  SshConfig,
  ValidationCheck,
  ValidationReport,
} from './types.js';
