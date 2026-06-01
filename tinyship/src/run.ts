/**
 * 文件说明: 包装子进程执行能力，让 TinyShip 在项目根目录中运行 ssh、rsync 等外部命令。
 */
import { spawn } from 'node:child_process';

import { defaultRootDir, shellQuote } from './config.js';
import type { CommandRunner } from './types.js';

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args.map(arg => /\s|["'|&;]/.test(arg) ? shellQuote(arg) : arg)].join(' ');
}

export const run: CommandRunner = (command, args, options = {}) => {
  const { rootDir = defaultRootDir, ...spawnOptions } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      ...spawnOptions,
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed code=${code} signal=${signal ?? ''}`));
    });

    child.on('error', reject);
  });
};

export const dryRun: CommandRunner = async (command, args) => {
  console.info(formatCommand(command, args));
};
