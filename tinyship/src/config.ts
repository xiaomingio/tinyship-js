/**
 * 文件说明: 提供 TinyShip 共享常量、路径工具、SSH 参数解析和项目配置加载能力。
 * 参考资料: packages/tinyship/README.md
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

import type { DeployConfig, EcosystemConfig, SshConfig } from './types.js';

export const defaultRootDir = process.cwd();
export const ecosystemFile = 'ecosystem.config.cjs';
export const defaultNpmInstallCommand = 'npm install --omit=dev';
export const requiredRsyncPaths: string[] = [];

export function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function productionEnvFileForScript(script: string): string {
  const normalizedScript = script.replaceAll('\\', '/');
  const segments = normalizedScript.split('/');
  const distIndex = segments.indexOf('dist');
  const appDir = distIndex > 0 ? segments.slice(0, distIndex).join('/') : '';
  return appDir ? `${appDir}/.env.production` : '.env.production';
}

export function projectPath(rootDir: string, relativePath: string): string {
  return path.join(rootDir, relativePath);
}

export function shellQuote(input: string | number): string {
  return `'${String(input).replaceAll("'", "'\\''")}'`;
}

export function sshTarget(ssh: SshConfig): string | null {
  if (typeof ssh?.target === 'string' && ssh.target.length > 0) return ssh.target;
  if (typeof ssh?.host === 'string' && ssh.host.length > 0) {
    return typeof ssh.user === 'string' && ssh.user.length > 0 ? `${ssh.user}@${ssh.host}` : ssh.host;
  }
  return null;
}

export function sshArgs(ssh: SshConfig): string[] {
  return [
    ...(ssh?.port !== undefined ? ['-p', String(ssh.port)] : []),
    ...(ssh?.identityFile ? ['-i', String(ssh.identityFile)] : []),
  ];
}

export function rsyncSshArgs(ssh: SshConfig): string[] {
  const args = sshArgs(ssh);
  return args.length > 0 ? ['-e', ['ssh', ...args].map(shellQuote).join(' ')] : [];
}

function normalizeRsyncPath(input: string): string {
  return input.replace(/\/+$/, '');
}

export function rsyncCoversPath(rsyncPaths: string[], path: string): boolean {
  const normalizedPath = normalizeRsyncPath(path);
  return rsyncPaths.some(rsyncPath => {
    const normalizedRsyncPath = normalizeRsyncPath(rsyncPath);
    return normalizedRsyncPath === normalizedPath || normalizedPath.startsWith(`${normalizedRsyncPath}/`);
  });
}

export async function loadDeployConfig(configPath: string | URL = 'tinyship.config.yml', rootDir = defaultRootDir): Promise<DeployConfig> {
  const resolvedPath = configPath instanceof URL ? configPath : projectPath(rootDir, configPath);
  return YAML.parse(await readFile(resolvedPath, 'utf8'));
}

export async function loadEcosystemConfig(ecosystemPath: string | URL | undefined = ecosystemFile, rootDir = defaultRootDir): Promise<EcosystemConfig> {
  ecosystemPath ??= ecosystemFile;
  const resolvedPath = ecosystemPath instanceof URL ? ecosystemPath : projectPath(rootDir, ecosystemPath);
  const moduleUrl = resolvedPath instanceof URL ? resolvedPath : pathToFileURL(resolvedPath);
  const module = await import(moduleUrl.href);
  return module.default ?? module;
}
