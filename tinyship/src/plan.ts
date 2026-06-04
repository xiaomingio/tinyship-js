/**
 * 文件说明: 校验 TinyShip deploy config 与 PM2 ecosystem，并生成每台 host 的部署计划。
 * 参考资料: tinyship.config.yml, ecosystem.config.cjs
 */
import { defaultNpmInstallCommand, ecosystemFile, envFileForNodeEnv, productionNodeEnvForService, requiredRsyncPaths, rsyncCoversPath, sshTarget, uniqueValues } from './config.js';
import type { DeployConfig, DeployHost, DeployPlan, DeployPlanService, EcosystemApp, EcosystemConfig } from './types.js';

function validateServiceActions(serviceName: string, service: DeployConfig['services'][string]): void {
  if (service.npmInstall !== undefined && typeof service.npmInstall !== 'boolean') {
    throw new Error(`Deploy service ${serviceName} npmInstall must be a boolean`);
  }

  if (service.pm2Restart !== undefined && typeof service.pm2Restart !== 'boolean') {
    throw new Error(`Deploy service ${serviceName} pm2Restart must be a boolean`);
  }

  const postCommand = service.postCommand ?? [];
  if (!Array.isArray(postCommand) || postCommand.some(command => typeof command !== 'string' || command.length === 0)) {
    throw new Error(`Deploy service ${serviceName} postCommand must be an array of non-empty strings`);
  }
}

function validateServices(deployConfig: DeployConfig): string[] {
  if (!deployConfig.services) return [];

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

    validateServiceActions(serviceName, service);
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

function serviceNamesForHost(hostName: string, deployConfig: DeployConfig, selectedServiceNames?: string[]): string[] {
  const allServiceNames = validateServices(deployConfig);
  const serviceNames = selectedServiceNames ?? allServiceNames.filter(serviceName => deployConfig.services[serviceName].host === hostName);

  for (const serviceName of serviceNames) {
    const service = deployConfig.services?.[serviceName];
    if (!service) throw new Error(`Unknown deploy service: ${serviceName}`);
    if (service.host !== hostName) throw new Error(`Deploy service ${serviceName} belongs to host ${service.host}, not ${hostName}`);
  }

  return serviceNames;
}

function resolvePm2Action(hostName: string, serviceNames: string[], deployConfig: DeployConfig, ecosystemConfig?: EcosystemConfig): { ecosystem: string; serviceNames: string[]; save: boolean } | undefined {
  const pm2ServiceNames = serviceNames.filter(serviceName => (deployConfig.services[serviceName].pm2Restart ?? true) === true);
  if (pm2ServiceNames.length === 0) return undefined;
  if (!ecosystemConfig) throw new Error(`Deploy host ${hostName} enables pm2Restart, but ecosystem config was not loaded`);

  return {
    ecosystem: ecosystemFile,
    serviceNames: pm2ServiceNames,
    save: true,
  };
}

function resolveNpmInstallCommand(serviceNames: string[], deployConfig: DeployConfig): string | undefined {
  return serviceNames.some(serviceName => (deployConfig.services[serviceName].npmInstall ?? true) === true)
    ? defaultNpmInstallCommand
    : undefined;
}

function resolvePostCommand(serviceNames: string[], deployConfig: DeployConfig): string[] {
  return serviceNames.flatMap(serviceName => deployConfig.services[serviceName].postCommand ?? []);
}

function resolveServices(serviceNames: string[], ecosystemConfig: EcosystemConfig): DeployPlanService[] {
  const apps = ecosystemAppByName(ecosystemConfig);

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
  if (!deployConfig || typeof deployConfig !== 'object') {
    throw new Error('Deploy config must be an object');
  }

  if (!deployConfig.hosts || typeof deployConfig.hosts !== 'object' || Array.isArray(deployConfig.hosts)) {
    throw new Error('Deploy config must define hosts');
  }

  const services = validateServices(deployConfig);
  const apps = ecosystemConfig ? validateEcosystemConfig(ecosystemConfig) : [];

  for (const hostName of Object.keys(deployConfig.hosts)) {
    const plan = createDeployPlan({ hostName, ecosystemConfig, deployConfig });

    if (plan.npmInstallCommand === defaultNpmInstallCommand && !plan.host.rsync.includes('package.json')) {
      throw new Error(`Deploy host ${hostName} enables npmInstall, but rsync is missing package.json`);
    }

    if (plan.pm2Restart && !plan.host.rsync.includes(plan.pm2Restart.ecosystem)) {
      throw new Error(`Deploy host ${hostName} enables pm2Restart, but rsync is missing ${plan.pm2Restart.ecosystem}`);
    }

    for (const service of plan.pm2Restart?.services ?? []) {
      const pm2App = apps.find(app => app.name === service.name);
      if (!pm2App) throw new Error(`Deploy service ${service.name} is missing from PM2 ecosystem apps`);
      if (!rsyncCoversPath(plan.host.rsync, pm2App.script)) {
        throw new Error(`Deploy host ${hostName} rsync is missing PM2 script: ${pm2App.script}`);
      }
    }

    for (const serviceName of services) {
      const service = deployConfig.services[serviceName];
      if (!deployConfig.hosts[service.host]) throw new Error(`Deploy service ${serviceName} references unknown host: ${service.host}`);
    }
  }
}

export function deployConfigNeedsEcosystemConfig(deployConfig: DeployConfig, serviceNames?: string[]): boolean {
  if (!deployConfig?.services || typeof deployConfig.services !== 'object' || Array.isArray(deployConfig.services)) return false;
  const services = serviceNames ? serviceNames.map(serviceName => deployConfig.services[serviceName]).filter(service => service) : Object.values(deployConfig.services);
  return services.some(service => (service.pm2Restart ?? true) === true);
}

export function createDeployPlan({ hostName, serviceNames: selectedServiceNames, ecosystemConfig, deployConfig }: {
  hostName: string;
  serviceNames?: string[];
  ecosystemConfig?: EcosystemConfig;
  deployConfig: DeployConfig;
}): DeployPlan {
  if (!deployConfig?.hosts || typeof deployConfig.hosts !== 'object') {
    throw new Error('Deploy config must define hosts');
  }

  const host = deployConfig.hosts[hostName];
  if (!host) {
    throw new Error(`Unknown deploy host: ${hostName}`);
  }

  validateHost(hostName, host);
  const serviceNames = serviceNamesForHost(hostName, deployConfig, selectedServiceNames);
  const npmInstallCommand = resolveNpmInstallCommand(serviceNames, deployConfig);
  const pm2Action = resolvePm2Action(hostName, serviceNames, deployConfig, ecosystemConfig);
  const services = pm2Action ? resolveServices(pm2Action.serviceNames, ecosystemConfig as EcosystemConfig) : [];
  const envFiles = uniqueValues(services.map(service => service.envFile));
  const postCommand = resolvePostCommand(serviceNames, deployConfig);

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
    npmInstallCommand,
    pm2Restart: pm2Action ? {
      ecosystem: pm2Action.ecosystem,
      services,
      save: pm2Action.save,
    } : undefined,
    postCommand,
  };
}

export function listDeployServices(deployConfig: DeployConfig): string[] {
  return validateServices(deployConfig);
}
