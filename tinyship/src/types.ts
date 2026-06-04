/**
 * 文件说明: 定义 TinyShip deploy config、PM2 ecosystem、部署计划和校验报告的共享类型。
 */
export type SshConfig = {
  target?: string;
  host?: string;
  user?: string;
  port?: number | string;
  identityFile?: string;
};

export type EcosystemApp = {
  name: string;
  script: string;
  env?: {
    NODE_ENV?: string;
  };
};

export type EcosystemConfig = {
  apps?: EcosystemApp[];
};

export type DeployHost = {
  ssh: SshConfig;
  appDir: string;
  rsync: string[];
};

export type DeployService = {
  host: string;
  npmInstall?: boolean;
  pm2Restart?: boolean;
  postCommand?: string[];
};

export type DeployConfig = {
  hosts: Record<string, DeployHost>;
  services: Record<string, DeployService>;
};

export type DeployPlanService = {
  name: string;
  nodeEnv: string;
  envFile: string;
};

export type DeployPlan = {
  name: string;
  host: DeployHost;
  services: DeployPlanService[];
  envFiles: string[];
  npmInstallCommand?: string;
  pm2Restart?: {
    ecosystem: string;
    services: DeployPlanService[];
    save: boolean;
  };
  postCommand: string[];
};

export type ValidationCheck = {
  group: string;
  name: string;
  detail?: string;
  ok: boolean;
  error?: string;
};

export type ValidationReport = {
  ok: boolean;
  hosts: Array<{
    name: string;
    sshTarget?: string;
    appDir?: string;
    rsyncCount: number;
    serviceCount: number;
  }>;
  services: Array<{
    name: string;
    host?: string;
    nodeEnv?: string;
    script?: string;
    envFile?: string;
  }>;
  checks: ValidationCheck[];
};

export type PreflightCheck = {
  host: string;
  name: string;
  detail?: string;
  ok: boolean;
  skipped?: boolean;
  output?: string;
  error?: string;
};

export type PreflightReport = {
  ok: boolean;
  hosts: Array<{
    name: string;
    sshTarget?: string;
    appDir?: string;
    checks: PreflightCheck[];
  }>;
  checks: PreflightCheck[];
};

export type DeployStep = {
  name: string;
  detail?: string;
  run(): Promise<void>;
};

export type CommandRunner = (command: string, args: string[], options?: { rootDir?: string }) => Promise<void>;
