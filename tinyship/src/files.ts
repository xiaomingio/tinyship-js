/**
 * 文件说明: 校验 TinyShip 发布前需要存在的 env 文件、rsync 路径和启用动作依赖的本地文件。
 * 参考资料: packages/tinyship/src/plan.ts
 */
import { access } from 'node:fs/promises';

import { defaultNpmInstallCommand, projectPath, rsyncCoversPath, uniqueValues } from './config.js';
import { createDeployPlan, validateDeployConfig } from './plan.js';
import type { DeployConfig, DeployPlan, EcosystemConfig } from './types.js';

export async function assertEnvFiles(plan: DeployPlan, rootDir: string): Promise<void> {
  for (const envFile of plan.envFiles) {
    try {
      await access(projectPath(rootDir, envFile));
    } catch {
      throw new Error(`Missing required production env file: ${envFile}`);
    }
  }
}

export async function assertRsyncPaths(plan: DeployPlan, ecosystemConfig: EcosystemConfig, rootDir: string): Promise<void> {
  const serviceScripts = (plan.pm2Restart?.services ?? []).map(service => {
    const pm2App = ecosystemConfig.apps?.find(app => app.name === service.name);
    if (!pm2App) throw new Error(`Deploy service ${service.name} is missing from PM2 ecosystem apps`);
    return pm2App.script;
  });
  const actionPaths = [
    ...(plan.npmInstallCommand === defaultNpmInstallCommand ? ['package.json'] : []),
    ...(plan.pm2Restart ? [plan.pm2Restart.ecosystem] : []),
  ];
  const paths = uniqueValues([...plan.rsync, ...serviceScripts, ...actionPaths]);

  for (const path of paths) {
    if (!rsyncCoversPath(plan.rsync, path)) {
      throw new Error(`Deploy host ${plan.name} rsync is missing PM2 script: ${path}`);
    }

    try {
      await access(projectPath(rootDir, path));
    } catch {
      throw new Error(`Deploy host ${plan.name} rsync path does not exist: ${path}`);
    }
  }
}

export async function validateDeployFiles({ deployConfig, ecosystemConfig, rootDir }: {
  deployConfig: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
  rootDir: string;
}): Promise<void> {
  validateDeployConfig({ deployConfig, ecosystemConfig });

  for (const hostName of Object.keys(deployConfig.hosts)) {
    const plan = createDeployPlan({ hostName, ecosystemConfig, deployConfig });
    await assertEnvFiles(plan, rootDir);
    if (plan.pm2Restart && !ecosystemConfig) throw new Error(`Deploy host ${hostName} enables pm2Restart, but ecosystem config was not loaded`);
    await assertRsyncPaths(plan, ecosystemConfig ?? { apps: [] }, rootDir);
  }
}
