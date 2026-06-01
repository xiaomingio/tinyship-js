/**
 * 文件说明: 校验 TinyShip deploy config 与 PM2 ecosystem，并生成每台 host 的部署计划。
 * 参考资料: tinyship.config.yml, ecosystem.config.cjs
 */
import { envFileForNodeEnv, productionNodeEnvForService, requiredRsyncPaths, rsyncCoversPath, sshTarget, uniqueValues } from './config.js';
import type { DeployConfig, DeployHost, DeployPlan, EcosystemApp, EcosystemConfig } from './types.js';

function validateServices(deployConfig: DeployConfig): string[] {
  if (!deployConfig.services || typeof deployConfig.services !== 'object' || Array.isArray(deployConfig.services)) {
    throw new Error('Deploy config must define services');
  }

  const serviceNames = Object.keys(deployConfig.services);
  if (serviceNames.length === 0) {
    throw new Error('Deploy config services must not be empty');
  }

  for (const serviceName of serviceNames) {
    const service = deployConfig.services[serviceName];
    if (!service || typeof service !== 'object' || Array.isArray(service)) {
      throw new Error(`Deploy service ${serviceName} must be an object`);
    }

    if (typeof service.host !== 'string' || service.host.length === 0) {
      throw new Error(`Deploy service ${serviceName} must define host`);
    }

    if (!deployConfig.hosts?.[service.host]) {
      throw new Error(`Deploy service ${serviceName} references unknown host: ${service.host}`);
    }
  }

  return serviceNames;
}

export function validateHost(hostName: string, host: DeployHost): void {
  if (!host || typeof host !== 'object') {
    throw new Error(`Deploy host ${hostName} must be an object`);
  }

  if (!host.ssh || typeof host.ssh !== 'object' || Array.isArray(host.ssh)) {
    throw new Error(`Deploy host ${hostName} must define ssh`);
  }

  if (!sshTarget(host.ssh)) {
    throw new Error(`Deploy host ${hostName} must define ssh.target or ssh.host`);
  }

  if (host.ssh.port !== undefined && (!Number.isInteger(Number(host.ssh.port)) || Number(host.ssh.port) <= 0)) {
    throw new Error(`Deploy host ${hostName} ssh.port must be a positive integer`);
  }

  if (typeof host.appDir !== 'string' || host.appDir.length === 0) {
    throw new Error(`Deploy host ${hostName} is missing appDir`);
  }

  if (!Array.isArray(host.rsync) || host.rsync.length === 0 || host.rsync.some(path => typeof path !== 'string' || path.length === 0)) {
    throw new Error(`Deploy host ${hostName} must define a non-empty rsync array`);
  }

  for (const requiredPath of requiredRsyncPaths) {
    if (!host.rsync.includes(requiredPath)) {
      throw new Error(`Deploy host ${hostName} rsync is missing required path: ${requiredPath}`);
    }
  }
}

function ecosystemAppByName(ecosystemConfig: EcosystemConfig): Map<string, EcosystemApp> {
  return new Map(validateEcosystemConfig(ecosystemConfig).map(app => [app.name, app]));
}

function resolveServices(hostName: string, deployConfig: DeployConfig, ecosystemConfig: EcosystemConfig): DeployPlan['services'] {
  const apps = ecosystemAppByName(ecosystemConfig);
  const serviceNames = validateServices(deployConfig).filter(serviceName => deployConfig.services[serviceName].host === hostName);

  if (serviceNames.length === 0) {
    throw new Error(`Deploy host ${hostName} must have at least one service`);
  }

  return serviceNames.map(serviceName => {
    const app = apps.get(serviceName);
    if (!app) throw new Error(`Deploy service ${serviceName} is missing from PM2 ecosystem apps`);

    const nodeEnv = app.env?.NODE_ENV;
    if (!nodeEnv) throw new Error(`PM2 service ${serviceName} is missing env.NODE_ENV`);
    const expectedNodeEnv = productionNodeEnvForService(serviceName);
    if (nodeEnv !== expectedNodeEnv) {
      throw new Error(`PM2 service ${serviceName} env.NODE_ENV must be ${expectedNodeEnv}`);
    }

    return {
      name: serviceName,
      nodeEnv,
      envFile: envFileForNodeEnv(nodeEnv),
    };
  });
}

export function validateEcosystemConfig(ecosystemConfig: EcosystemConfig): EcosystemApp[] {
  if (!ecosystemConfig || typeof ecosystemConfig !== 'object') {
    throw new Error('Ecosystem config must be an object');
  }

  if (!Array.isArray(ecosystemConfig.apps) || ecosystemConfig.apps.length === 0) {
    throw new Error('Ecosystem config must define a non-empty apps array');
  }

  const appNames = new Set();

  for (const [index, app] of ecosystemConfig.apps.entries()) {
    const label = app?.name ?? `apps[${index}]`;

    if (!app || typeof app !== 'object') {
      throw new Error(`PM2 app ${label} must be an object`);
    }

    if (typeof app.name !== 'string' || app.name.length === 0) {
      throw new Error(`PM2 app apps[${index}] is missing name`);
    }

    if (appNames.has(app.name)) {
      throw new Error(`Duplicate PM2 app name: ${app.name}`);
    }
    appNames.add(app.name);

    if (typeof app.script !== 'string' || app.script.length === 0) {
      throw new Error(`PM2 app ${label} is missing script`);
    }

    if (typeof app.env?.NODE_ENV !== 'string' || app.env.NODE_ENV.length === 0) {
      throw new Error(`PM2 app ${label} is missing env.NODE_ENV`);
    }
  }

  return ecosystemConfig.apps;
}

export function validateDeployConfig({ deployConfig, ecosystemConfig }: {
  deployConfig: DeployConfig;
  ecosystemConfig?: EcosystemConfig;
}): void {
  if (!ecosystemConfig) {
    throw new Error('Deploy validation requires ecosystemConfig');
  }

  if (!deployConfig || typeof deployConfig !== 'object') {
    throw new Error('Deploy config must be an object');
  }

  if (!deployConfig.hosts || typeof deployConfig.hosts !== 'object' || Array.isArray(deployConfig.hosts)) {
    throw new Error('Deploy config must define hosts');
  }

  validateEcosystemConfig(ecosystemConfig);
  validateServices(deployConfig);
  const apps = ecosystemConfig.apps ?? [];

  for (const hostName of Object.keys(deployConfig.hosts)) {
    const plan = createDeployPlan({ hostName, ecosystemConfig, deployConfig });

    for (const service of plan.services) {
      const pm2App = apps.find(app => app.name === service.name);
      if (!pm2App) throw new Error(`Deploy service ${service.name} is missing from PM2 ecosystem apps`);
      if (!rsyncCoversPath(plan.host.rsync, pm2App.script)) {
        throw new Error(`Deploy host ${hostName} rsync is missing PM2 script: ${pm2App.script}`);
      }
    }
  }
}

export function createDeployPlan({ hostName, ecosystemConfig, deployConfig }: {
  hostName: string;
  ecosystemConfig?: EcosystemConfig;
  deployConfig: DeployConfig;
}): DeployPlan {
  if (!ecosystemConfig) {
    throw new Error('Deploy plan requires ecosystemConfig');
  }

  if (!deployConfig?.hosts || typeof deployConfig.hosts !== 'object') {
    throw new Error('Deploy config must define hosts');
  }

  const host = deployConfig.hosts[hostName];
  if (!host) {
    throw new Error(`Unknown deploy host: ${hostName}`);
  }

  validateHost(hostName, host);
  const services = resolveServices(hostName, deployConfig, ecosystemConfig);
  const envFiles = uniqueValues(services.map(service => service.envFile));

  for (const envFile of envFiles) {
    if (!host.rsync.includes(envFile)) {
      throw new Error(`Deploy host ${hostName} rsync is missing required env file: ${envFile}`);
    }
  }

  return {
    name: hostName,
    host,
    services,
    envFiles,
  };
}

export function listDeployServices(deployConfig: DeployConfig): string[] {
  return validateServices(deployConfig);
}
