/**
 * 文件说明: 运行时 env 注册入口，根据 APP_ENV 或 NODE_ENV 从当前工作目录加载 .env 文件。
 */
import dotenv from 'dotenv';

const runtimeEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';

function defaultEnvPath(): string {
  if (runtimeEnv === 'development') return '.env';
  return `.env.${runtimeEnv}`;
}

const envPath = process.env.DOTENV_CONFIG_PATH || defaultEnvPath();

dotenv.config({ path: envPath });

export const loadedEnv = {
  name: runtimeEnv,
  path: envPath,
};
